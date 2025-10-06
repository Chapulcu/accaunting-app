-- Basit Customers (Müşteriler) Tablosu
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    tax_number TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own customers" ON customers;
CREATE POLICY "Users can view own customers" ON customers
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create customers" ON customers;
CREATE POLICY "Users can create customers" ON customers
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own customers" ON customers;
CREATE POLICY "Users can update own customers" ON customers
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own customers" ON customers;
CREATE POLICY "Users can delete own customers" ON customers
    FOR DELETE USING (user_id = auth.uid());

-- Trigger
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
