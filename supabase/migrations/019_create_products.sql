-- Ürün Kategorileri Tablosu
CREATE TABLE product_categories (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Ürünler Tablosu
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id INTEGER REFERENCES product_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    barcode TEXT,
    unit TEXT DEFAULT 'adet',
    purchase_price DECIMAL(15,2) DEFAULT 0,
    sale_price DECIMAL(15,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 18,
    stock_quantity DECIMAL(15,2) DEFAULT 0,
    min_stock_level DECIMAL(15,2) DEFAULT 0,
    max_stock_level DECIMAL(15,2),
    reorder_point DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    is_service BOOLEAN DEFAULT false,
    track_inventory BOOLEAN DEFAULT true,
    image_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, sku)
);

-- Indexes
CREATE INDEX idx_product_categories_user_id ON product_categories(user_id);
CREATE INDEX idx_product_categories_name ON product_categories(name);
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_is_active ON products(is_active);

-- RLS Policies - Product Categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own product categories" ON product_categories
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own product categories" ON product_categories
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own product categories" ON product_categories
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own product categories" ON product_categories
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies - Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON products
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own products" ON products
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own products" ON products
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own products" ON products
    FOR DELETE USING (user_id = auth.uid());

-- Triggers
CREATE TRIGGER update_product_categories_updated_at
    BEFORE UPDATE ON product_categories
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function: Varsayılan ürün kategorilerini oluştur
CREATE OR REPLACE FUNCTION create_default_product_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO product_categories (user_id, name, description) VALUES
    (p_user_id, 'Genel', 'Genel ürünler'),
    (p_user_id, 'Hizmet', 'Hizmet ürünleri'),
    (p_user_id, 'Yazılım', 'Yazılım ürünleri'),
    (p_user_id, 'Donanım', 'Donanım ürünleri'),
    (p_user_id, 'Danışmanlık', 'Danışmanlık hizmetleri')
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Mevcut kullanıcılara varsayılan kategorileri ekle
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM profiles LOOP
        PERFORM create_default_product_categories(user_record.id);
    END LOOP;
END $$;

-- Yeni kullanıcılar için trigger güncelle (eğer initialize_user_data fonksiyonu varsa)
CREATE OR REPLACE FUNCTION initialize_user_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Hesap planını oluştur
    PERFORM create_default_accounts(NEW.id);

    -- KDV oranlarını ekle
    PERFORM create_default_tax_rates(NEW.id);

    -- Gider kategorilerini ekle
    PERFORM create_default_expense_categories(NEW.id);

    -- Ürün kategorilerini ekle
    PERFORM create_default_product_categories(NEW.id);

    -- Uygulama ayarlarını oluştur
    INSERT INTO app_settings (user_id, company_name, email)
    VALUES (NEW.id, NEW.company_name, NEW.email)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
