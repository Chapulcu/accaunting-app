-- ====================================
-- STOK YÖNETİMİ TABLES
-- ====================================

-- Ürün kategorileri
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ürünler/Hizmetler
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES product_categories(id) ON DELETE SET NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  product_type VARCHAR(20) DEFAULT 'product' CHECK (product_type IN ('product', 'service')),
  unit VARCHAR(20) DEFAULT 'adet',

  -- Fiyatlar
  purchase_price DECIMAL(15, 2) DEFAULT 0,
  sale_price DECIMAL(15, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 20,

  -- Stok bilgileri (sadece ürünler için)
  track_inventory BOOLEAN DEFAULT true,
  current_stock DECIMAL(15, 3) DEFAULT 0,
  minimum_stock DECIMAL(15, 3) DEFAULT 0,
  maximum_stock DECIMAL(15, 3),
  reorder_point DECIMAL(15, 3),

  -- Diğer
  barcode VARCHAR(100),
  sku VARCHAR(100),
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Stok hareketleri
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'transfer')),
  quantity DECIMAL(15, 3) NOT NULL,
  unit_cost DECIMAL(15, 2),
  total_cost DECIMAL(15, 2),

  -- İlişkili döküman
  reference_type VARCHAR(50), -- 'invoice', 'expense', 'manual'
  reference_id BIGINT,

  notes TEXT,
  movement_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ====================================
-- INDEXES
-- ====================================

CREATE INDEX idx_product_categories_user ON product_categories(user_id);
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);

-- ====================================
-- ROW LEVEL SECURITY
-- ====================================

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Product Categories Policies
CREATE POLICY "Users can view their own product categories"
  ON product_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product categories"
  ON product_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product categories"
  ON product_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product categories"
  ON product_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Products Policies
CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (auth.uid() = user_id);

-- Stock Movements Policies
CREATE POLICY "Users can view their own stock movements"
  ON stock_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ====================================
-- TRIGGERS
-- ====================================

-- Updated at trigger for product_categories
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON product_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Updated at trigger for products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Stok güncelleme trigger'ı
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Stok takibı yapılıyorsa güncelle
  IF EXISTS (SELECT 1 FROM products WHERE id = NEW.product_id AND track_inventory = true) THEN
    UPDATE products
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock();

-- ====================================
-- VARSAYILAN KATEGORİLER
-- ====================================

-- Bu kısım ilk kullanıcı kaydında çalıştırılmalı
-- Veya manuel olarak her kullanıcı için oluşturulmalı

COMMENT ON TABLE product_categories IS 'Ürün kategorileri';
COMMENT ON TABLE products IS 'Ürünler ve hizmetler';
COMMENT ON TABLE stock_movements IS 'Stok giriş/çıkış hareketleri';
