-- Hesap Planı (Chart of Accounts) Tablosu
CREATE TABLE chart_of_accounts (
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

CREATE POLICY "Users can view own chart of accounts" ON chart_of_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chart of accounts" ON chart_of_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chart of accounts" ON chart_of_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chart of accounts" ON chart_of_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updating updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
    BEFORE UPDATE ON chart_of_accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Index for better performance
CREATE INDEX idx_chart_of_accounts_user_id ON chart_of_accounts(user_id);
CREATE INDEX idx_chart_of_accounts_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX idx_chart_of_accounts_account_type ON chart_of_accounts(account_type);
