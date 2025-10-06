-- Drop old UUID-based functions
DROP FUNCTION IF EXISTS get_invoice_paid_amount(UUID);
DROP FUNCTION IF EXISTS get_invoice_remaining_amount(UUID);

-- Now the new INTEGER-based functions from 013_create_payments.sql can be created
