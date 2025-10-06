-- Gider Kategorileri Tablosu
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Giderler Tablosu
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    receipt_url TEXT,
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uygulama Ayarları Tablosu
CREATE TABLE app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton pattern
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT,
    company_logo_url TEXT,
    tax_number TEXT,
    tax_office TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    default_currency TEXT DEFAULT 'TRY',
    default_tax_rate DECIMAL(5,2) DEFAULT 18,
    fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
    invoice_prefix TEXT DEFAULT 'INV',
    invoice_number_start INTEGER DEFAULT 1,
    language TEXT DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    decimal_separator TEXT DEFAULT ',',
    thousands_separator TEXT DEFAULT '.',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vergi Oranları Tablosu
CREATE TABLE tax_rates (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    rate DECIMAL(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Döviz Kurları Tablosu
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP')),
    rate DECIMAL(10,4) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'TCMB',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(currency, date)
);

-- Indexes
CREATE INDEX idx_expense_categories_user_id ON expense_categories(user_id);
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_tax_rates_user_id ON tax_rates(user_id);
CREATE INDEX idx_exchange_rates_currency_date ON exchange_rates(currency, date);

-- RLS Policies - Expense Categories
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expense categories" ON expense_categories
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses" ON expenses
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app settings" ON app_settings
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own app settings" ON app_settings
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own app settings" ON app_settings
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies - Tax Rates
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tax rates" ON tax_rates
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Exchange Rates (Public read, admin write)
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exchange rates" ON exchange_rates
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage exchange rates" ON exchange_rates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Triggers
CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_tax_rates_updated_at
    BEFORE UPDATE ON tax_rates
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Standart KDV oranlarını ekle
CREATE OR REPLACE FUNCTION create_default_tax_rates(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO tax_rates (user_id, name, rate, description) VALUES
    (p_user_id, 'KDV %1', 1.00, 'İstisnai ürünler'),
    (p_user_id, 'KDV %8', 8.00, 'Temel gıda maddeleri'),
    (p_user_id, 'KDV %10', 10.00, 'Bazı tarım ürünleri'),
    (p_user_id, 'KDV %18', 18.00, 'Genel KDV oranı'),
    (p_user_id, 'KDV %20', 20.00, 'Lüks tüketim malları')
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function: Standart gider kategorilerini ekle
CREATE OR REPLACE FUNCTION create_default_expense_categories(p_user_id UUID)
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

-- Function: Kullanıcı için başlangıç verilerini oluştur
CREATE OR REPLACE FUNCTION initialize_user_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Hesap planını oluştur
    PERFORM create_default_accounts(NEW.id);

    -- KDV oranlarını ekle
    PERFORM create_default_tax_rates(NEW.id);

    -- Gider kategorilerini ekle
    PERFORM create_default_expense_categories(NEW.id);

    -- Uygulama ayarlarını oluştur
    INSERT INTO app_settings (user_id, company_name, email)
    VALUES (NEW.id, NEW.company_name, NEW.email);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER initialize_new_user_data
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_data();
