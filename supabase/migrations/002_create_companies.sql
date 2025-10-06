-- Şirketler/Cariler Tablosu
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('customer', 'supplier', 'both')),
    tax_number TEXT,
    tax_office TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Türkiye',
    postal_code TEXT,
    website TEXT,
    contact_person TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    balance DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_companies_type ON companies(type);
CREATE INDEX idx_companies_is_active ON companies(is_active);
CREATE INDEX idx_companies_tax_number ON companies(tax_number);

-- RLS Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own companies" ON companies
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create companies" ON companies
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own companies" ON companies
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own companies" ON companies
    FOR DELETE USING (user_id = auth.uid());

-- Trigger
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
