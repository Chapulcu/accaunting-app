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
