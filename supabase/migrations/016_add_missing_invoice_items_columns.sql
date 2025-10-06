-- Add missing columns to invoice_items table if they don't exist

-- Add account_id if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'account_id'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add quantity if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'quantity'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add unit_price if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'unit_price'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN unit_price DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add tax_rate if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'tax_rate'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 18;
    END IF;
END $$;

-- Add tax_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'tax_amount'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add discount_rate if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'discount_rate'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN discount_rate DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

-- Add discount_amount if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN discount_amount DECIMAL(15,2) DEFAULT 0;
    END IF;
END $$;

-- Add total if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoice_items' AND column_name = 'total'
    ) THEN
        ALTER TABLE invoice_items ADD COLUMN total DECIMAL(15,2) NOT NULL DEFAULT 0;
    END IF;
END $$;
