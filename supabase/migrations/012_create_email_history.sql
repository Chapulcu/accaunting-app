-- Email History Table
-- Tracks all emails sent from the application

CREATE TABLE IF NOT EXISTS email_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_history_user_id ON email_history(user_id);
CREATE INDEX idx_email_history_invoice_id ON email_history(invoice_id);
CREATE INDEX idx_email_history_status ON email_history(status);
CREATE INDEX idx_email_history_sent_at ON email_history(sent_at DESC);

-- RLS Policies
ALTER TABLE email_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own email history
CREATE POLICY "Users can view their own email history"
    ON email_history FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own email history
CREATE POLICY "Users can insert their own email history"
    ON email_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_email_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_history_updated_at
    BEFORE UPDATE ON email_history
    FOR EACH ROW
    EXECUTE FUNCTION update_email_history_updated_at();

-- Comments
COMMENT ON TABLE email_history IS 'Tracks all emails sent from the application';
COMMENT ON COLUMN email_history.status IS 'Email status: sent, failed, pending';
COMMENT ON COLUMN email_history.error_message IS 'Error message if email failed to send';
