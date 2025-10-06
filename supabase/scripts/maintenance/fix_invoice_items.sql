-- Önce mevcut invoice tablosunun id tipini kontrol edelim ve ona göre items tablosu oluşturalım

-- Invoice Items tablosunu oluştur (invoice_id tipini INTEGER olarak)
DROP TABLE IF EXISTS invoice_items CASCADE;

CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 20,
    tax_amount DECIMAL(15,2) NOT NULL,
    discount_rate DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own invoice items" ON invoice_items;
CREATE POLICY "Users can manage own invoice items" ON invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM invoices
            WHERE invoices.id = invoice_items.invoice_id
            AND invoices.user_id = auth.uid()
        )
    );

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_items;
CREATE TRIGGER update_invoice_items_updated_at
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Fatura toplamlarını otomatik hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE invoices
    SET
        subtotal = (
            SELECT COALESCE(SUM(quantity * unit_price - discount_amount), 0)
            FROM invoice_items
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ),
        tax_amount = (
            SELECT COALESCE(SUM(tax_amount), 0)
            FROM invoice_items
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        ),
        total_amount = (
            SELECT COALESCE(SUM(total), 0)
            FROM invoice_items
            WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
        )
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoice_totals ON invoice_items;
CREATE TRIGGER update_invoice_totals
    AFTER INSERT OR UPDATE OR DELETE ON invoice_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_totals();
