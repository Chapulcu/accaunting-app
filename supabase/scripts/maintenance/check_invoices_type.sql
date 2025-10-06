-- Invoices tablosunun yapısını kontrol et
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- Customers tablosunun yapısını da kontrol et
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
