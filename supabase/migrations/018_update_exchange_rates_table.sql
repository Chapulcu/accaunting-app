-- Eski exchange_rates tablosunu kaldır ve yeniden oluştur
DROP TABLE IF EXISTS exchange_rates CASCADE;

-- Yeni exchange_rates tablosu
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    currency_code TEXT NOT NULL,
    buy_rate DECIMAL(15,4) NOT NULL,
    sell_rate DECIMAL(15,4) NOT NULL,
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    source TEXT DEFAULT 'TCMB',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, currency_code, effective_date)
);

-- Indexes
CREATE INDEX idx_exchange_rates_user_id ON exchange_rates(user_id);
CREATE INDEX idx_exchange_rates_currency_date ON exchange_rates(currency_code, effective_date);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date);

-- RLS Policies
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi kurlarını görebilir
CREATE POLICY "Users can view own exchange rates" ON exchange_rates
    FOR SELECT USING (user_id = auth.uid());

-- Kullanıcılar kendi kurlarını ekleyebilir
CREATE POLICY "Users can insert own exchange rates" ON exchange_rates
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Kullanıcılar kendi kurlarını güncelleyebilir
CREATE POLICY "Users can update own exchange rates" ON exchange_rates
    FOR UPDATE USING (user_id = auth.uid());

-- Kullanıcılar kendi kurlarını silebilir
CREATE POLICY "Users can delete own exchange rates" ON exchange_rates
    FOR DELETE USING (user_id = auth.uid());

-- Trigger
CREATE TRIGGER update_exchange_rates_updated_at
    BEFORE UPDATE ON exchange_rates
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
