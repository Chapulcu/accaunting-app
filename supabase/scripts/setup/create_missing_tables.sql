-- 1. Customers Tablosu
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

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own customers" ON customers;
CREATE POLICY "Users can manage own customers" ON customers
    FOR ALL USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. Expense Categories Tablosu
CREATE TABLE IF NOT EXISTS expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_user_id ON expense_categories(user_id);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own expense categories" ON expense_categories;
CREATE POLICY "Users can manage own expense categories" ON expense_categories
    FOR ALL USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 3. Expenses Tablosu
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'bank_transfer')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;
CREATE POLICY "Users can manage own expenses" ON expenses
    FOR ALL USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 4. Invoices Tablosu (Basit versiyon)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
CREATE POLICY "Users can manage own invoices" ON invoices
    FOR ALL USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 5. Standart gider kategorilerini oluşturan fonksiyon
CREATE OR REPLACE FUNCTION create_default_expense_categories_simple(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO expense_categories (user_id, name, description) VALUES
    (p_user_id, 'Kira', 'Ofis ve işyeri kira ödemeleri'),
    (p_user_id, 'Maaş', 'Personel maaş ödemeleri'),
    (p_user_id, 'Elektrik', 'Elektrik faturaları'),
    (p_user_id, 'Su', 'Su faturaları'),
    (p_user_id, 'İnternet', 'İnternet ve telefon faturaları'),
    (p_user_id, 'Ofis Malzemeleri', 'Kırtasiye ve ofis malzemeleri'),
    (p_user_id, 'Ulaşım', 'Ulaşım ve seyahat giderleri'),
    (p_user_id, 'Pazarlama', 'Reklam ve pazarlama giderleri'),
    (p_user_id, 'Bakım-Onarım', 'Bakım ve onarım giderleri'),
    (p_user_id, 'Danışmanlık', 'Hukuki ve mali danışmanlık'),
    (p_user_id, 'Diğer', 'Diğer genel giderler')
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 6. Mevcut kullanıcılara gider kategorilerini ekle
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM profiles
    LOOP
        PERFORM create_default_expense_categories_simple(user_record.id);
    END LOOP;
END $$;
