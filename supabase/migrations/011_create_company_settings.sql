-- Şirket Ayarları Tablosu
CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    company_name TEXT,
    tax_number TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    currency TEXT DEFAULT 'TRY',
    tax_rate DECIMAL(5,2) DEFAULT 20.00,
    invoice_prefix TEXT DEFAULT 'INV',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings" ON company_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company settings" ON company_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company settings" ON company_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own company settings" ON company_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updating updated_at
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Index for better performance
CREATE INDEX idx_company_settings_user_id ON company_settings(user_id);
