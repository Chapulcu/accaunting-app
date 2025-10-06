-- Add missing columns to invoices table if they don't exist

-- Add invoice_date if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'invoice_date'
    ) THEN
        ALTER TABLE invoices ADD COLUMN invoice_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Add due_date if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'due_date'
    ) THEN
        ALTER TABLE invoices ADD COLUMN due_date DATE;
    END IF;
END $$;

-- Add subtotal if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'subtotal'
    ) THEN
        ALTER TABLE invoices ADD COLUMN subtotal DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add tax_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'tax_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add total_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN total_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add company_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;
        CREATE INDEX idx_invoices_company_id ON invoices(company_id);
    END IF;
END $$;

-- Add invoice_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'invoice_type'
    ) THEN
        ALTER TABLE invoices ADD COLUMN invoice_type TEXT NOT NULL DEFAULT 'sales' CHECK (invoice_type IN ('sales', 'purchase'));
    END IF;
END $$;

-- Add description if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'description'
    ) THEN
        ALTER TABLE invoices ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add discount_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0;
    END IF;
END $$;

-- Add currency if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'currency'
    ) THEN
        ALTER TABLE invoices ADD COLUMN currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP'));
    END IF;
END $$;

-- Add exchange_rate if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'exchange_rate'
    ) THEN
        ALTER TABLE invoices ADD COLUMN exchange_rate DECIMAL(10,4) DEFAULT 1;
    END IF;
END $$;

-- Add payment_method if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE invoices ADD COLUMN payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card', 'check', 'promissory_note'));
    END IF;
END $$;

-- Add notes if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'notes'
    ) THEN
        ALTER TABLE invoices ADD COLUMN notes TEXT;
    END IF;
END $$;
