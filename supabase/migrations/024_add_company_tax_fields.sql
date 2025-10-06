-- Add tax-related fields to companies table for e-invoice integration

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS tax_number TEXT, -- VKN/TCKN
ADD COLUMN IF NOT EXISTS tax_office TEXT; -- Vergi Dairesi

COMMENT ON COLUMN companies.tax_number IS 'Vergi Kimlik Numarası (VKN) veya TC Kimlik No';
COMMENT ON COLUMN companies.tax_office IS 'Vergi Dairesi';
