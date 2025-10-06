-- Banka API Entegrasyonu için gerekli alanlar ve tablolar

-- bank_accounts tablosuna API alanları ekle
ALTER TABLE bank_accounts
ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_provider TEXT, -- 'isbank', 'garanti', 'yapikredi', 'mock'
ADD COLUMN IF NOT EXISTS api_customer_number TEXT,
ADD COLUMN IF NOT EXISTS api_access_token TEXT,
ADD COLUMN IF NOT EXISTS api_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS api_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false;

-- Banka API Credentials Tablosu (şifreli)
CREATE TABLE IF NOT EXISTS bank_api_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('isbank', 'garanti', 'yapikredi', 'akbank', 'mock')),

    -- API Credentials (encrypted in app layer)
    customer_number TEXT,
    username TEXT,
    password_encrypted TEXT, -- Şifrelenmiş şifre
    certificate_path TEXT, -- Sertifika dosya yolu
    api_key TEXT,

    -- OAuth tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(bank_account_id)
);

-- Banka Senkronizasyon Logları
CREATE TABLE IF NOT EXISTS bank_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

    sync_date TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),

    transactions_fetched INTEGER DEFAULT 0,
    transactions_imported INTEGER DEFAULT 0,
    transactions_skipped INTEGER DEFAULT 0,

    error_message TEXT,
    sync_details JSONB, -- Detaylı log bilgisi

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- bank_transactions tablosuna API kaynağı ekle
ALTER TABLE bank_transactions
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'api', 'import')),
ADD COLUMN IF NOT EXISTS external_id TEXT, -- Banka sistemindeki ID
ADD COLUMN IF NOT EXISTS raw_data JSONB, -- Ham banka verisi
ADD COLUMN IF NOT EXISTS reconciled BOOLEAN DEFAULT false, -- Mutabakat yapıldı mı
ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id);

-- Mutabakat Kuralları Tablosu
CREATE TABLE IF NOT EXISTS reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,

    rule_name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('exact_match', 'amount_match', 'description_pattern')),

    -- Eşleşme kriterleri
    match_description_pattern TEXT,
    match_amount_tolerance DECIMAL(15,2) DEFAULT 0,
    match_date_tolerance INTEGER DEFAULT 0, -- gün cinsinden

    -- Otomatik işlem
    auto_reconcile BOOLEAN DEFAULT false,
    auto_create_journal BOOLEAN DEFAULT false,
    default_account_id INTEGER REFERENCES accounts(id),

    priority INTEGER DEFAULT 0, -- Yüksek öncelikli kurallar önce çalışır
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_api_credentials_user_id ON bank_api_credentials(user_id);
CREATE INDEX idx_bank_api_credentials_bank_account_id ON bank_api_credentials(bank_account_id);

CREATE INDEX idx_bank_sync_logs_user_id ON bank_sync_logs(user_id);
CREATE INDEX idx_bank_sync_logs_bank_account_id ON bank_sync_logs(bank_account_id);
CREATE INDEX idx_bank_sync_logs_sync_date ON bank_sync_logs(sync_date);

CREATE INDEX idx_bank_transactions_source ON bank_transactions(source);
CREATE INDEX idx_bank_transactions_external_id ON bank_transactions(external_id);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(reconciled);

CREATE INDEX idx_reconciliation_rules_user_id ON reconciliation_rules(user_id);
CREATE INDEX idx_reconciliation_rules_bank_account_id ON reconciliation_rules(bank_account_id);
CREATE INDEX idx_reconciliation_rules_priority ON reconciliation_rules(priority DESC);

-- RLS Policies
ALTER TABLE bank_api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank API credentials" ON bank_api_credentials
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own bank sync logs" ON bank_sync_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank sync logs" ON bank_sync_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own reconciliation rules" ON reconciliation_rules
    FOR ALL USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_bank_api_credentials_updated_at
    BEFORE UPDATE ON bank_api_credentials
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_reconciliation_rules_updated_at
    BEFORE UPDATE ON reconciliation_rules
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Helper Function: Otomatik mutabakat çalıştır
CREATE OR REPLACE FUNCTION auto_reconcile_transaction(p_transaction_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_transaction bank_transactions%ROWTYPE;
    v_rule reconciliation_rules%ROWTYPE;
    v_matched BOOLEAN := false;
BEGIN
    -- Transaction bilgisini al
    SELECT * INTO v_transaction
    FROM bank_transactions
    WHERE id = p_transaction_id;

    -- Aktif kuralları priority sırasına göre kontrol et
    FOR v_rule IN
        SELECT * FROM reconciliation_rules
        WHERE user_id = v_transaction.user_id
        AND (bank_account_id IS NULL OR bank_account_id = v_transaction.bank_account_id)
        AND is_active = true
        ORDER BY priority DESC
    LOOP
        -- Kural tipine göre eşleşme kontrolü
        IF v_rule.rule_type = 'description_pattern' THEN
            IF v_transaction.description ~ v_rule.match_description_pattern THEN
                v_matched := true;
            END IF;
        END IF;

        -- Eşleşme bulundu ve otomatik mutabakat aktif
        IF v_matched AND v_rule.auto_reconcile THEN
            UPDATE bank_transactions
            SET
                reconciled = true,
                reconciled_at = NOW(),
                reconciled_by = v_transaction.user_id
            WHERE id = p_transaction_id;

            RETURN true;
        END IF;
    END LOOP;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE bank_api_credentials IS 'Banka API kimlik bilgileri (şifreli)';
COMMENT ON TABLE bank_sync_logs IS 'Banka senkronizasyon logları';
COMMENT ON TABLE reconciliation_rules IS 'Otomatik mutabakat kuralları';
