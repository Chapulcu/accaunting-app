-- Recurring Invoices Table
-- Manages automatic invoice generation on a recurring basis

CREATE TYPE recurrence_interval AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');

CREATE TABLE IF NOT EXISTS recurring_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Recurrence settings
    interval_type recurrence_interval NOT NULL DEFAULT 'monthly',
    interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
    start_date DATE NOT NULL,
    end_date DATE,
    next_invoice_date DATE NOT NULL,

    -- Invoice template
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    -- Tracking
    total_generated INT DEFAULT 0,
    last_generated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Invoice Items Table
CREATE TABLE IF NOT EXISTS recurring_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_invoice_id UUID NOT NULL REFERENCES recurring_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(15, 2) NOT NULL CHECK (unit_price >= 0),
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 20 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    discount_rate DECIMAL(5, 2) DEFAULT 0 CHECK (discount_rate >= 0 AND discount_rate < 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recurring_invoices_user_id ON recurring_invoices(user_id);
CREATE INDEX idx_recurring_invoices_company_id ON recurring_invoices(company_id);
CREATE INDEX idx_recurring_invoices_status ON recurring_invoices(status);
CREATE INDEX idx_recurring_invoices_next_date ON recurring_invoices(next_invoice_date);
CREATE INDEX idx_recurring_invoice_items_recurring_invoice_id ON recurring_invoice_items(recurring_invoice_id);

-- RLS Policies
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoice_items ENABLE ROW LEVEL SECURITY;

-- Recurring Invoices Policies
CREATE POLICY "Users can view their own recurring invoices"
    ON recurring_invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring invoices"
    ON recurring_invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring invoices"
    ON recurring_invoices FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring invoices"
    ON recurring_invoices FOR DELETE
    USING (auth.uid() = user_id);

-- Recurring Invoice Items Policies
CREATE POLICY "Users can view their own recurring invoice items"
    ON recurring_invoice_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM recurring_invoices
            WHERE recurring_invoices.id = recurring_invoice_items.recurring_invoice_id
            AND recurring_invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own recurring invoice items"
    ON recurring_invoice_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM recurring_invoices
            WHERE recurring_invoices.id = recurring_invoice_items.recurring_invoice_id
            AND recurring_invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own recurring invoice items"
    ON recurring_invoice_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM recurring_invoices
            WHERE recurring_invoices.id = recurring_invoice_items.recurring_invoice_id
            AND recurring_invoices.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own recurring invoice items"
    ON recurring_invoice_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM recurring_invoices
            WHERE recurring_invoices.id = recurring_invoice_items.recurring_invoice_id
            AND recurring_invoices.user_id = auth.uid()
        )
    );

-- Update trigger
CREATE OR REPLACE FUNCTION update_recurring_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recurring_invoices_updated_at
    BEFORE UPDATE ON recurring_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_recurring_invoices_updated_at();

-- Function to calculate next invoice date
CREATE OR REPLACE FUNCTION calculate_next_invoice_date(
    base_date DATE,
    interval_type_param recurrence_interval,
    interval_count_param INT
)
RETURNS DATE AS $$
BEGIN
    CASE interval_type_param
        WHEN 'daily' THEN
            RETURN base_date + (interval_count_param || ' days')::INTERVAL;
        WHEN 'weekly' THEN
            RETURN base_date + (interval_count_param || ' weeks')::INTERVAL;
        WHEN 'monthly' THEN
            RETURN base_date + (interval_count_param || ' months')::INTERVAL;
        WHEN 'quarterly' THEN
            RETURN base_date + (interval_count_param * 3 || ' months')::INTERVAL;
        WHEN 'yearly' THEN
            RETURN base_date + (interval_count_param || ' years')::INTERVAL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice from recurring template
-- This would be called by a cron job or edge function
CREATE OR REPLACE FUNCTION generate_invoice_from_recurring(recurring_invoice_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    rec_invoice RECORD;
    new_invoice_id INTEGER;
    invoice_number TEXT;
BEGIN
    -- Get recurring invoice details
    SELECT * INTO rec_invoice
    FROM recurring_invoices
    WHERE id = recurring_invoice_id_param
    AND status = 'active'
    AND next_invoice_date <= CURRENT_DATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Generate invoice number
    invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(recurring_invoice_id_param::TEXT, 6, '0');

    -- Create new invoice
    INSERT INTO invoices (
        user_id,
        company_id,
        invoice_type,
        invoice_number,
        invoice_date,
        due_date,
        status,
        notes,
        subtotal,
        tax_amount,
        total_amount
    )
    SELECT
        rec_invoice.user_id,
        rec_invoice.company_id,
        'sales',
        invoice_number,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '30 days',
        'draft',
        rec_invoice.notes,
        0, -- Will be calculated by trigger
        0,
        0
    RETURNING id INTO new_invoice_id;

    -- Copy recurring items to invoice items
    INSERT INTO invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        tax_rate,
        discount_rate,
        total
    )
    SELECT
        new_invoice_id,
        description,
        quantity,
        unit_price,
        tax_rate,
        discount_rate,
        quantity * unit_price * (1 - discount_rate / 100) * (1 + tax_rate / 100)
    FROM recurring_invoice_items
    WHERE recurring_invoice_id = recurring_invoice_id_param;

    -- Update recurring invoice
    UPDATE recurring_invoices
    SET
        next_invoice_date = calculate_next_invoice_date(next_invoice_date, interval_type, interval_count),
        total_generated = total_generated + 1,
        last_generated_at = NOW(),
        status = CASE
            WHEN end_date IS NOT NULL AND calculate_next_invoice_date(next_invoice_date, interval_type, interval_count) > end_date
            THEN 'completed'
            ELSE status
        END
    WHERE id = recurring_invoice_id_param;

    RETURN new_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE recurring_invoices IS 'Manages recurring invoice templates';
COMMENT ON COLUMN recurring_invoices.interval_type IS 'Recurrence frequency: daily, weekly, monthly, quarterly, yearly';
COMMENT ON COLUMN recurring_invoices.interval_count IS 'Number of intervals between invoices (e.g., 2 for every 2 months)';
COMMENT ON COLUMN recurring_invoices.next_invoice_date IS 'Next date to generate invoice';
COMMENT ON COLUMN recurring_invoices.status IS 'active, paused, completed, cancelled';
COMMENT ON FUNCTION calculate_next_invoice_date IS 'Calculates the next invoice date based on interval';
COMMENT ON FUNCTION generate_invoice_from_recurring IS 'Generates a new invoice from recurring template';
