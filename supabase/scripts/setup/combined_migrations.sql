-- Kullanıcı Profilleri Tablosu
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'accountant', 'admin')),
    company_name TEXT,
    tax_number TEXT,
    phone TEXT,
    address TEXT,
    language TEXT DEFAULT 'tr' CHECK (language IN ('tr', 'en')),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Otomatik profil oluşturma
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
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
-- Hesap Planı Tablosu
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- Sistem hesapları kullanıcı tarafından silinemez
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- Indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);
CREATE INDEX idx_accounts_code ON accounts(code);

-- RLS Policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create accounts" ON accounts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (user_id = auth.uid() AND is_system = false);

-- Trigger
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Standart Hesap Planı için Function
CREATE OR REPLACE FUNCTION create_default_accounts(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Varlıklar (1xx)
    INSERT INTO accounts (user_id, code, name, type, is_system) VALUES
    (p_user_id, '100', 'KASA', 'asset', true),
    (p_user_id, '102', 'BANKALAR', 'asset', true),
    (p_user_id, '120', 'ALICILAR', 'asset', true),
    (p_user_id, '121', 'ALACAK SENETLERİ', 'asset', true),
    (p_user_id, '153', 'TİCARİ MALLAR', 'asset', true),

    -- Yükümlülükler (2xx)
    (p_user_id, '200', 'SATICILAR', 'liability', true),
    (p_user_id, '201', 'BORÇ SENETLERİ', 'liability', true),
    (p_user_id, '320', 'BANK KREDILERI', 'liability', true),
    (p_user_id, '360', 'ÖDENECEK VERGİ VE FONLAR', 'liability', true),

    -- Öz Sermaye (5xx)
    (p_user_id, '500', 'SERMAYE', 'equity', true),
    (p_user_id, '590', 'DÖNEM NET KARI', 'equity', true),
    (p_user_id, '591', 'DÖNEM NET ZARARI', 'equity', true),

    -- Gelirler (6xx)
    (p_user_id, '600', 'YURTİÇİ SATIŞLAR', 'income', true),
    (p_user_id, '601', 'YURTDIŞI SATIŞLAR', 'income', true),
    (p_user_id, '610', 'HİZMET GELİRLERİ', 'income', true),
    (p_user_id, '646', 'FAİZ GELİRLERİ', 'income', true),
    (p_user_id, '679', 'DİĞER OLAĞANDIŞI GELİRLER', 'income', true),

    -- Giderler (7xx)
    (p_user_id, '700', 'YURTİÇİ ALIMLAR', 'expense', true),
    (p_user_id, '701', 'YURTDIŞI ALIMLAR', 'expense', true),
    (p_user_id, '710', 'GENEL YÖNETİM GİDERLERİ', 'expense', true),
    (p_user_id, '720', 'PAZARLAMA GİDERLERİ', 'expense', true),
    (p_user_id, '770', 'KIRA GİDERLERİ', 'expense', true),
    (p_user_id, '780', 'FİNANSMAN GİDERLERİ', 'expense', true),
    (p_user_id, '789', 'DİĞER OLAĞANDIŞI GİDERLER', 'expense', true);
END;
$$ LANGUAGE plpgsql;
-- Faturalar Tablosu
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
    invoice_number TEXT NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    description TEXT,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card', 'check', 'promissory_note')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, invoice_number)
);

-- Fatura Kalemleri Tablosu
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 18, -- KDV oranı (%)
    tax_amount DECIMAL(15,2) NOT NULL,
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- RLS Policies - Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create invoices" ON invoices
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own invoices" ON invoices
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own invoices" ON invoices
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies - Invoice Items
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create invoice items" ON invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own invoice items" ON invoice_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own invoice items" ON invoice_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.user_id = auth.uid()
        )
    );

-- Triggers
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Fatura toplamını otomatik hesapla
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Fatura toplamlarını güncelle
    UPDATE invoices
    SET
        subtotal = (
            SELECT COALESCE(SUM(quantity * unit_price - discount_amount), 0)
            FROM invoice_items
            WHERE invoice_id = NEW.invoice_id
        ),
        tax_amount = (
            SELECT COALESCE(SUM(tax_amount), 0)
            FROM invoice_items
            WHERE invoice_id = NEW.invoice_id
        ),
        total_amount = (
            SELECT COALESCE(SUM(total), 0)
            FROM invoice_items
            WHERE invoice_id = NEW.invoice_id
        )
    WHERE id = NEW.invoice_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_totals
    AFTER INSERT OR UPDATE OR DELETE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_totals();
-- Banka Hesapları Tablosu
CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    branch_code TEXT,
    account_number TEXT,
    iban TEXT,
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banka Hareketleri Tablosu
CREATE TABLE bank_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number TEXT,
    balance_after DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kasa Hesapları Tablosu
CREATE TABLE cash_registers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kasa Hareketleri Tablosu
CREATE TABLE cash_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    cash_register_id INTEGER REFERENCES cash_registers(id) ON DELETE CASCADE NOT NULL,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_number TEXT,
    balance_after DECIMAL(15,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Çek/Senet Tablosu
CREATE TABLE checks (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('received', 'issued')),
    document_type TEXT NOT NULL CHECK (document_type IN ('check', 'promissory_note')),
    check_number TEXT NOT NULL,
    bank_name TEXT,
    branch_name TEXT,
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'paid', 'bounced', 'cancelled')),
    endorsement_info TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_bank_transactions_user_id ON bank_transactions(user_id);
CREATE INDEX idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

CREATE INDEX idx_cash_registers_user_id ON cash_registers(user_id);
CREATE INDEX idx_cash_transactions_user_id ON cash_transactions(user_id);
CREATE INDEX idx_cash_transactions_cash_register_id ON cash_transactions(cash_register_id);
CREATE INDEX idx_cash_transactions_date ON cash_transactions(transaction_date);

CREATE INDEX idx_checks_user_id ON checks(user_id);
CREATE INDEX idx_checks_company_id ON checks(company_id);
CREATE INDEX idx_checks_type ON checks(type);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_due_date ON checks(due_date);

-- RLS Policies - Bank Accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank accounts" ON bank_accounts
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Bank Transactions
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bank transactions" ON bank_transactions
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Cash Registers
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cash registers" ON cash_registers
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Cash Transactions
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cash transactions" ON cash_transactions
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies - Checks
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own checks" ON checks
    FOR ALL USING (user_id = auth.uid());

-- Triggers
CREATE TRIGGER update_bank_accounts_updated_at
    BEFORE UPDATE ON bank_accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at
    BEFORE UPDATE ON bank_transactions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_cash_registers_updated_at
    BEFORE UPDATE ON cash_registers
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_cash_transactions_updated_at
    BEFORE UPDATE ON cash_transactions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_checks_updated_at
    BEFORE UPDATE ON checks
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Banka bakiyesini otomatik güncelle
CREATE OR REPLACE FUNCTION update_bank_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE bank_accounts
    SET current_balance = current_balance +
        CASE
            WHEN NEW.transaction_type = 'deposit' THEN NEW.amount
            WHEN NEW.transaction_type = 'withdrawal' THEN -NEW.amount
            ELSE 0
        END
    WHERE id = NEW.bank_account_id;

    -- İşlem sonrası bakiyeyi kaydet
    NEW.balance_after = (
        SELECT current_balance
        FROM bank_accounts
        WHERE id = NEW.bank_account_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_balance_trigger
    BEFORE INSERT ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_bank_balance();

-- Function: Kasa bakiyesini otomatik güncelle
CREATE OR REPLACE FUNCTION update_cash_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cash_registers
    SET current_balance = current_balance +
        CASE
            WHEN NEW.transaction_type = 'income' THEN NEW.amount
            WHEN NEW.transaction_type = 'expense' THEN -NEW.amount
            ELSE 0
        END
    WHERE id = NEW.cash_register_id;

    -- İşlem sonrası bakiyeyi kaydet
    NEW.balance_after = (
        SELECT current_balance
        FROM cash_registers
        WHERE id = NEW.cash_register_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cash_balance_trigger
    BEFORE INSERT ON cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_cash_balance();
-- Muhasebe Kayıtları (Yevmiye) Tablosu
CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_number TEXT,
    description TEXT NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('invoice', 'payment', 'manual', 'opening', 'closing')),
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

-- Muhasebe Detayları Tablosu
CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT NOT NULL,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit = 0 OR credit = 0)  -- Bir satırda sadece borç veya alacak olabilir
);

-- Indexes
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- RLS Policies - Journal Entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries" ON journal_entries
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create journal entries" ON journal_entries
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update draft journal entries" ON journal_entries
    FOR UPDATE USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Users can delete draft journal entries" ON journal_entries
    FOR DELETE USING (user_id = auth.uid() AND status = 'draft');

-- RLS Policies - Journal Entry Lines
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entry lines" ON journal_entry_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create journal entry lines" ON journal_entry_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can update journal entry lines" ON journal_entry_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can delete journal entry lines" ON journal_entry_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

-- Triggers
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_journal_entry_lines_updated_at
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Yevmiye toplamlarını otomatik hesapla ve dengele
CREATE OR REPLACE FUNCTION calculate_journal_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    -- Toplam borç ve alacak hesapla
    SELECT
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = NEW.journal_entry_id;

    -- Yevmiye toplamlarını güncelle
    UPDATE journal_entries
    SET
        total_debit = v_total_debit,
        total_credit = v_total_credit
    WHERE id = NEW.journal_entry_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journal_totals
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_journal_totals();

-- Function: Yevmiye kaydını deftere kaydet (post)
CREATE OR REPLACE FUNCTION post_journal_entry(p_journal_entry_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    -- Borç ve alacak toplamlarını kontrol et
    SELECT total_debit, total_credit
    INTO v_total_debit, v_total_credit
    FROM journal_entries
    WHERE id = p_journal_entry_id;

    -- Borç ve alacak eşit olmalı
    IF v_total_debit != v_total_credit THEN
        RAISE EXCEPTION 'Borç ve alacak tutarları eşit olmalı. Borç: %, Alacak: %', v_total_debit, v_total_credit;
    END IF;

    -- En az bir satır olmalı
    IF v_total_debit = 0 THEN
        RAISE EXCEPTION 'Yevmiye kaydı en az bir borç veya alacak satırı içermelidir';
    END IF;

    -- Durumu posted olarak güncelle
    UPDATE journal_entries
    SET
        status = 'posted',
        posted_at = NOW()
    WHERE id = p_journal_entry_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View: Hesap bakiyeleri
CREATE OR REPLACE VIEW account_balances AS
SELECT
    a.id,
    a.user_id,
    a.code,
    a.name,
    a.type,
    COALESCE(SUM(jel.debit), 0) as total_debit,
    COALESCE(SUM(jel.credit), 0) as total_credit,
    CASE
        WHEN a.type IN ('asset', 'expense') THEN COALESCE(SUM(jel.debit - jel.credit), 0)
        WHEN a.type IN ('liability', 'equity', 'income') THEN COALESCE(SUM(jel.credit - jel.debit), 0)
    END as balance
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.is_active = true
GROUP BY a.id, a.user_id, a.code, a.name, a.type;
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
