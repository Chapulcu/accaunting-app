-- Complete Journal Entries and Chart of Accounts Setup
-- Bu migration journal_entries ve chart_of_accounts sistemini tamamen kurar

-- 0. update_updated_at_column fonksiyonu (eğer yoksa)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 0.5. chart_of_accounts tablosunu oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- RLS Policies for chart_of_accounts
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can view own chart of accounts" ON chart_of_accounts
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can insert own chart of accounts" ON chart_of_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can update own chart of accounts" ON chart_of_accounts
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can delete own chart of accounts" ON chart_of_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for chart_of_accounts updated_at
DROP TRIGGER IF EXISTS update_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Indexes for chart_of_accounts
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_account_type ON chart_of_accounts(account_type);

-- 1. journal_entries tablosunu oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_number TEXT,
    description TEXT NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('invoice', 'payment', 'expense', 'manual', 'opening', 'closing')),
    reference_id INTEGER,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ,
    UNIQUE(user_id, entry_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);

-- RLS Policies - Journal Entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal entries" ON journal_entries;
CREATE POLICY "Users can view own journal entries" ON journal_entries
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create journal entries" ON journal_entries;
CREATE POLICY "Users can create journal entries" ON journal_entries
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update draft journal entries" ON journal_entries;
CREATE POLICY "Users can update draft journal entries" ON journal_entries
    FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "Users can delete draft journal entries" ON journal_entries;
CREATE POLICY "Users can delete draft journal entries" ON journal_entries
    FOR DELETE USING (user_id = auth.uid() AND status = 'draft');

-- Trigger for journal_entries updated_at
DROP TRIGGER IF EXISTS update_journal_entries_updated_at ON journal_entries;
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. journal_entry_lines tablosu - chart_of_accounts ile uyumlu
DROP TABLE IF EXISTS journal_entry_lines CASCADE;

CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit = 0 OR credit = 0)
);

-- Indexes
CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- RLS Policies - Journal Entry Lines
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can view own journal entry lines" ON journal_entry_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can create journal entry lines" ON journal_entry_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

DROP POLICY IF EXISTS "Users can update journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can update journal entry lines" ON journal_entry_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

DROP POLICY IF EXISTS "Users can delete journal entry lines" ON journal_entry_lines;
CREATE POLICY "Users can delete journal entry lines" ON journal_entry_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

-- Trigger for journal_entry_lines updated_at
DROP TRIGGER IF EXISTS update_journal_entry_lines_updated_at ON journal_entry_lines;
CREATE TRIGGER update_journal_entry_lines_updated_at
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 3. account_balances view
DROP VIEW IF EXISTS account_balances CASCADE;

CREATE VIEW account_balances AS
SELECT
    a.id,
    a.user_id,
    a.code,
    a.name,
    a.account_type as type,
    COALESCE(SUM(jel.debit), 0) as total_debit,
    COALESCE(SUM(jel.credit), 0) as total_credit,
    CASE
        WHEN a.account_type IN ('asset', 'expense') THEN COALESCE(SUM(jel.debit - jel.credit), 0)
        WHEN a.account_type IN ('liability', 'equity', 'revenue') THEN COALESCE(SUM(jel.credit - jel.debit), 0)
    END as balance
FROM chart_of_accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.is_active = true
GROUP BY a.id, a.user_id, a.code, a.name, a.account_type;

-- 4. Varsayılan hesap planı oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Önce mevcut kayıtları kontrol et
    IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE user_id = p_user_id LIMIT 1) THEN
        RAISE NOTICE 'User already has chart of accounts';
        RETURN;
    END IF;

    -- Varlıklar (1xx)
    INSERT INTO chart_of_accounts (user_id, code, name, account_type, description) VALUES
    (p_user_id, '100', 'KASA', 'asset', 'Nakit para'),
    (p_user_id, '102', 'BANKALAR', 'asset', 'Banka hesapları'),
    (p_user_id, '120', 'ALICILAR', 'asset', 'Müşterilerden alacaklar'),
    (p_user_id, '121', 'ALACAK SENETLERİ', 'asset', 'Senetli alacaklar'),
    (p_user_id, '153', 'TİCARİ MALLAR', 'asset', 'Satılmak üzere alınan mallar'),
    (p_user_id, '180', 'GELECEK AYLARA AİT GİDERLER', 'asset', 'Peşin ödenen giderler'),
    (p_user_id, '191', 'İNDİRİLECEK KDV', 'asset', 'Alışlardaki KDV'),

    -- Kısa Vadeli Yükümlülükler (3xx)
    (p_user_id, '320', 'SATICILAR', 'liability', 'Satıcılara borçlar'),
    (p_user_id, '321', 'BORÇ SENETLERİ', 'liability', 'Senetli borçlar'),
    (p_user_id, '360', 'ÖDENECEK VERGİ VE FONLAR', 'liability', 'Vergi dairesi borçları'),
    (p_user_id, '391', 'HESAPLANAN KDV', 'liability', 'Satışlardaki KDV'),

    -- Uzun Vadeli Yükümlülükler (4xx)
    (p_user_id, '400', 'BANKA KREDİLERİ', 'liability', 'Uzun vadeli kredi borçları'),

    -- Öz Sermaye (5xx)
    (p_user_id, '500', 'SERMAYE', 'equity', 'Şirket sermayesi'),
    (p_user_id, '540', 'GEÇMİŞ YILLAR KARLARI', 'equity', 'Dağıtılmamış karlar'),
    (p_user_id, '570', 'GEÇMİŞ YILLAR ZARARLARI', 'equity', 'Geçmiş dönem zararları'),
    (p_user_id, '590', 'DÖNEM NET KARI', 'equity', 'Cari dönem karı'),
    (p_user_id, '591', 'DÖNEM NET ZARARI', 'equity', 'Cari dönem zararı'),

    -- Gelirler (6xx)
    (p_user_id, '600', 'YURTİÇİ SATIŞLAR', 'revenue', 'Türkiye içi satışlar'),
    (p_user_id, '601', 'YURTDIŞI SATIŞLAR', 'revenue', 'İhracat satışları'),
    (p_user_id, '602', 'DİĞER GELİRLER', 'revenue', 'Yan gelirler'),
    (p_user_id, '610', 'HİZMET GELİRLERİ', 'revenue', 'Hizmet satışları'),
    (p_user_id, '646', 'FAİZ GELİRLERİ', 'revenue', 'Faiz ve vade farkı gelirleri'),
    (p_user_id, '656', 'KAMBİYO KARLARI', 'revenue', 'Döviz kuru karları'),
    (p_user_id, '679', 'DİĞER OLAĞANDIŞI GELİRLER', 'revenue', 'Olağandışı gelirler'),

    -- Giderler (7xx)
    (p_user_id, '700', 'YURTİÇİ ALIMLAR', 'expense', 'Türkiye içi alımlar'),
    (p_user_id, '701', 'YURTDIŞI ALIMLAR', 'expense', 'İthalat'),
    (p_user_id, '710', 'DİREKT İŞÇİLİK GİDERLERİ', 'expense', 'Maaş ve ücretler'),
    (p_user_id, '720', 'GENEL ÜRETİM GİDERLERİ', 'expense', 'Üretim giderleri'),
    (p_user_id, '730', 'GENEL YÖNETİM GİDERLERİ', 'expense', 'Yönetim giderleri'),
    (p_user_id, '740', 'PAZARLAMA SATIŞ VE DAĞITIM GİDERLERİ', 'expense', 'Satış giderleri'),
    (p_user_id, '750', 'ARAŞTIRMA VE GELİŞTİRME GİDERLERİ', 'expense', 'Ar-Ge harcamaları'),
    (p_user_id, '760', 'FİNANSMAN GİDERLERİ', 'expense', 'Faiz ve vade farkı giderleri'),
    (p_user_id, '770', 'KİRA GİDERLERİ', 'expense', 'Kira ödemeleri'),
    (p_user_id, '780', 'AMORTİSMAN VE TÜKENME PAYLARI', 'expense', 'Amortisman giderleri'),
    (p_user_id, '789', 'DİĞER OLAĞANDIŞI GİDERLER', 'expense', 'Olağandışı giderler'),
    (p_user_id, '796', 'KAMBİYO ZARARLARI', 'expense', 'Döviz kuru zararları');

END;
$$ LANGUAGE plpgsql;

-- 5. Yevmiye toplamlarını otomatik hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_journal_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO v_total_debit, v_total_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = OLD.journal_entry_id;

        UPDATE journal_entries
        SET
            total_debit = v_total_debit,
            total_credit = v_total_credit
        WHERE id = OLD.journal_entry_id;

        RETURN OLD;
    ELSE
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO v_total_debit, v_total_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.journal_entry_id;

        UPDATE journal_entries
        SET
            total_debit = v_total_debit,
            total_credit = v_total_credit
        WHERE id = NEW.journal_entry_id;

        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_journal_totals ON journal_entry_lines;
CREATE TRIGGER update_journal_totals
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_journal_totals();

-- 6. Yevmiye kaydını deftere kaydet (post) fonksiyonu
CREATE OR REPLACE FUNCTION post_journal_entry(p_journal_entry_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    SELECT total_debit, total_credit
    INTO v_total_debit, v_total_credit
    FROM journal_entries
    WHERE id = p_journal_entry_id;

    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'Borç ve alacak tutarları eşit olmalı. Borç: %, Alacak: %', v_total_debit, v_total_credit;
    END IF;

    IF v_total_debit = 0 THEN
        RAISE EXCEPTION 'Yevmiye kaydı en az bir borç veya alacak satırı içermelidir';
    END IF;

    UPDATE journal_entries
    SET
        status = 'posted',
        posted_at = NOW()
    WHERE id = p_journal_entry_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_chart_of_accounts IS 'Yeni kullanıcı için varsayılan Türk Tekdüzen Hesap Planı oluşturur';
COMMENT ON FUNCTION post_journal_entry IS 'Yevmiye kaydını deftere işler (posted durumuna getirir)';
