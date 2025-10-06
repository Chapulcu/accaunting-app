-- Payments Table
-- Tracks all payments received for invoices (supports partial payments)

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card', 'check', 'other')),
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);

-- RLS Policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payments
CREATE POLICY "Users can view their own payments"
    ON payments FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own payments
CREATE POLICY "Users can insert their own payments"
    ON payments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own payments
CREATE POLICY "Users can update their own payments"
    ON payments FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own payments
CREATE POLICY "Users can delete their own payments"
    ON payments FOR DELETE
    USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Function to calculate invoice paid amount
CREATE OR REPLACE FUNCTION get_invoice_paid_amount(invoice_id_param INTEGER)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
    paid_amount DECIMAL(15, 2);
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO paid_amount
    FROM payments
    WHERE invoice_id = invoice_id_param;

    RETURN paid_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to get invoice remaining amount
CREATE OR REPLACE FUNCTION get_invoice_remaining_amount(invoice_id_param INTEGER)
RETURNS DECIMAL(15, 2) AS $$
DECLARE
    total_amount DECIMAL(15, 2);
    paid_amount DECIMAL(15, 2);
BEGIN
    SELECT i.total_amount
    INTO total_amount
    FROM invoices i
    WHERE i.id = invoice_id_param;

    SELECT get_invoice_paid_amount(invoice_id_param)
    INTO paid_amount;

    RETURN total_amount - paid_amount;
END;
$$ LANGUAGE plpgsql;

-- Auto-update invoice status based on payments
CREATE OR REPLACE FUNCTION auto_update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(15, 2);
    invoice_paid DECIMAL(15, 2);
BEGIN
    -- Get invoice total
    SELECT total_amount INTO invoice_total
    FROM invoices
    WHERE id = NEW.invoice_id;

    -- Get total paid amount
    SELECT get_invoice_paid_amount(NEW.invoice_id) INTO invoice_paid;

    -- Update invoice status
    IF invoice_paid >= invoice_total THEN
        UPDATE invoices
        SET status = 'paid'
        WHERE id = NEW.invoice_id;
    ELSIF invoice_paid > 0 THEN
        -- Partial payment - keep as 'sent' but could add 'partial' status later
        UPDATE invoices
        SET status = 'sent'
        WHERE id = NEW.invoice_id AND status = 'draft';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_invoice_status_after_payment
    AFTER INSERT ON payments
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_invoice_status_on_payment();

-- Also update when payment is deleted
CREATE OR REPLACE FUNCTION auto_update_invoice_status_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
    invoice_total DECIMAL(15, 2);
    invoice_paid DECIMAL(15, 2);
BEGIN
    -- Get invoice total
    SELECT total_amount INTO invoice_total
    FROM invoices
    WHERE id = OLD.invoice_id;

    -- Get total paid amount (after this payment is deleted)
    SELECT get_invoice_paid_amount(OLD.invoice_id) INTO invoice_paid;

    -- Update invoice status
    IF invoice_paid >= invoice_total THEN
        UPDATE invoices
        SET status = 'paid'
        WHERE id = OLD.invoice_id;
    ELSIF invoice_paid = 0 THEN
        UPDATE invoices
        SET status = 'sent'
        WHERE id = OLD.invoice_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_invoice_status_after_payment_delete
    AFTER DELETE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_invoice_status_on_payment_delete();

-- Comments
COMMENT ON TABLE payments IS 'Tracks all payments received for invoices';
COMMENT ON COLUMN payments.payment_method IS 'Payment method: cash, bank_transfer, credit_card, check, other';
COMMENT ON COLUMN payments.reference_number IS 'Bank reference, check number, or transaction ID';
COMMENT ON FUNCTION get_invoice_paid_amount IS 'Calculates total paid amount for an invoice';
COMMENT ON FUNCTION get_invoice_remaining_amount IS 'Calculates remaining unpaid amount for an invoice';
