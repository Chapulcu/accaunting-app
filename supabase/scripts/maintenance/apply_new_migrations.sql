-- ==================================================
-- NEW MIGRATIONS TO APPLY
-- ==================================================
-- Run this SQL in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ==================================================
-- MIGRATION 010: Chart of Accounts
-- ==================================================

-- Hesap Planı (Chart of Accounts) Tablosu
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

-- RLS Policies
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

-- Trigger for updating updated_at (requires update_updated_at_column function)
DROP TRIGGER IF EXISTS update_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_account_type ON chart_of_accounts(account_type);

-- ==================================================
-- MIGRATION 011: Company Settings
-- ==================================================

-- Şirket Ayarları Tablosu
CREATE TABLE IF NOT EXISTS company_settings (
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

DROP POLICY IF EXISTS "Users can view own company settings" ON company_settings;
CREATE POLICY "Users can view own company settings" ON company_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own company settings" ON company_settings;
CREATE POLICY "Users can insert own company settings" ON company_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own company settings" ON company_settings;
CREATE POLICY "Users can update own company settings" ON company_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own company settings" ON company_settings;
CREATE POLICY "Users can delete own company settings" ON company_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updating updated_at
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);

-- ==================================================
-- VERIFICATION QUERIES (run these to check)
-- ==================================================

-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('chart_of_accounts', 'company_settings');

-- Check RLS policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('chart_of_accounts', 'company_settings');
