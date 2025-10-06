-- E-Fatura/E-Arşiv Sistemi Setup
-- Bu migration e-belge entegrasyonu için gerekli tabloları oluşturur

-- 1. E-Fatura Entegratör Ayarları
CREATE TABLE IF NOT EXISTS e_invoice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('foriba', 'biges', 'uyumsoft', 'custom')),
    environment TEXT NOT NULL CHECK (environment IN ('test', 'production')),

    -- API Credentials (encrypted)
    api_username TEXT,
    api_password TEXT,
    api_key TEXT,
    api_url TEXT,

    -- Company Info for e-invoice
    vkn TEXT, -- Vergi Kimlik Numarası
    company_title TEXT,
    tax_office TEXT,

    -- Settings
    auto_send BOOLEAN DEFAULT false,
    auto_create_journal BOOLEAN DEFAULT true,
    default_invoice_type TEXT DEFAULT 'SATIS', -- SATIS, IADE, TEVKIFAT

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- 2. E-Fatura Kayıtları
CREATE TABLE IF NOT EXISTS e_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,

    -- E-Fatura Bilgileri
    e_invoice_uuid UUID UNIQUE, -- GİB UUID
    envelope_uuid UUID, -- Zarf UUID
    invoice_number TEXT NOT NULL,
    invoice_type TEXT DEFAULT 'SATIS', -- SATIS, IADE, TEVKIFAT, ISTISNA

    -- Durum Bilgileri
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft',           -- Taslak
        'created',         -- Oluşturuldu
        'signed',          -- İmzalandı
        'sent',            -- Gönderildi
        'delivered',       -- Teslim edildi
        'accepted',        -- Kabul edildi
        'rejected',        -- Reddedildi
        'cancelled',       -- İptal edildi
        'failed'           -- Başarısız
    )),

    direction TEXT NOT NULL CHECK (direction IN ('outgoing', 'incoming')),

    -- Tarihler
    issue_date DATE NOT NULL,
    send_date TIMESTAMPTZ,
    delivery_date TIMESTAMPTZ,
    response_date TIMESTAMPTZ,

    -- Tutar Bilgileri
    subtotal DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'TRY',

    -- Taraf Bilgileri
    seller_vkn TEXT,
    seller_title TEXT,
    buyer_vkn TEXT,
    buyer_title TEXT,
    buyer_tax_office TEXT,

    -- XML ve Response
    xml_content TEXT, -- UBL-TR XML
    response_code TEXT,
    response_message TEXT,
    rejection_reason TEXT,

    -- Entegratör Bilgileri
    provider TEXT,
    provider_invoice_id TEXT, -- Entegratör ID

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, invoice_number, issue_date)
);

-- 3. E-Fatura Hareketleri (Log)
CREATE TABLE IF NOT EXISTS e_invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    e_invoice_id UUID NOT NULL REFERENCES e_invoices(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL CHECK (event_type IN (
        'created', 'signed', 'sent', 'delivered',
        'accepted', 'rejected', 'cancelled', 'error'
    )),

    event_data JSONB,
    message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 4. E-Arşiv Ayarları (Opsiyonel - bireysel müşteriler için)
CREATE TABLE IF NOT EXISTS e_archive_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    internet_sales_enabled BOOLEAN DEFAULT false, -- İnternet satış belgesi
    default_scenario TEXT DEFAULT 'TEMELFATURA', -- TEMELFATURA, TICARIFATURA

    -- Seri Bilgileri
    prefix_series TEXT DEFAULT 'MGA', -- MGA, MGS vb.
    current_number INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX idx_e_invoices_user_id ON e_invoices(user_id);
CREATE INDEX idx_e_invoices_status ON e_invoices(status);
CREATE INDEX idx_e_invoices_direction ON e_invoices(direction);
CREATE INDEX idx_e_invoices_issue_date ON e_invoices(issue_date);
CREATE INDEX idx_e_invoices_uuid ON e_invoices(e_invoice_uuid);
CREATE INDEX idx_e_invoice_events_e_invoice_id ON e_invoice_events(e_invoice_id);

-- RLS Policies
ALTER TABLE e_invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_invoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_archive_settings ENABLE ROW LEVEL SECURITY;

-- e_invoice_settings policies
CREATE POLICY "Users can view own e-invoice settings" ON e_invoice_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own e-invoice settings" ON e_invoice_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own e-invoice settings" ON e_invoice_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own e-invoice settings" ON e_invoice_settings
    FOR DELETE USING (auth.uid() = user_id);

-- e_invoices policies
CREATE POLICY "Users can view own e-invoices" ON e_invoices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own e-invoices" ON e_invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own e-invoices" ON e_invoices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own e-invoices" ON e_invoices
    FOR DELETE USING (auth.uid() = user_id);

-- e_invoice_events policies
CREATE POLICY "Users can view events for own e-invoices" ON e_invoice_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM e_invoices
            WHERE e_invoices.id = e_invoice_events.e_invoice_id
            AND e_invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert events for own e-invoices" ON e_invoice_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM e_invoices
            WHERE e_invoices.id = e_invoice_events.e_invoice_id
            AND e_invoices.user_id = auth.uid()
        )
    );

-- e_archive_settings policies
CREATE POLICY "Users can view own e-archive settings" ON e_archive_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own e-archive settings" ON e_archive_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own e-archive settings" ON e_archive_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_e_invoice_settings_updated_at
    BEFORE UPDATE ON e_invoice_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_e_invoices_updated_at
    BEFORE UPDATE ON e_invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_e_archive_settings_updated_at
    BEFORE UPDATE ON e_archive_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Helper Function: E-Fatura durumunu güncelle ve event kaydet
CREATE OR REPLACE FUNCTION update_e_invoice_status(
    p_e_invoice_id UUID,
    p_new_status TEXT,
    p_message TEXT DEFAULT NULL,
    p_event_data JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Durumu güncelle
    UPDATE e_invoices
    SET
        status = p_new_status,
        updated_at = NOW()
    WHERE id = p_e_invoice_id;

    -- Event kaydet
    INSERT INTO e_invoice_events (e_invoice_id, event_type, message, event_data, created_by)
    VALUES (p_e_invoice_id, p_new_status, p_message, p_event_data, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View: E-Fatura Özeti
CREATE OR REPLACE VIEW e_invoice_summary AS
SELECT
    e.id,
    e.user_id,
    e.invoice_number,
    e.e_invoice_uuid,
    e.status,
    e.direction,
    e.issue_date,
    e.total_amount,
    e.currency,
    e.buyer_title,
    e.seller_title,
    i.id as local_invoice_id,
    i.invoice_number as local_invoice_number,
    c.name as company_name,
    COUNT(ev.id) as event_count
FROM e_invoices e
LEFT JOIN invoices i ON e.invoice_id = i.id
LEFT JOIN companies c ON i.company_id = c.id
LEFT JOIN e_invoice_events ev ON e.id = ev.e_invoice_id
GROUP BY e.id, i.id, c.name;

COMMENT ON TABLE e_invoice_settings IS 'E-Fatura entegratör ayarları';
COMMENT ON TABLE e_invoices IS 'E-Fatura kayıtları (giden ve gelen)';
COMMENT ON TABLE e_invoice_events IS 'E-Fatura durum değişiklik logları';
COMMENT ON TABLE e_archive_settings IS 'E-Arşiv fatura ayarları';
