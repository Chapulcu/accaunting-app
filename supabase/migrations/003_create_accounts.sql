-- Hesap Planı Tablosu
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false, -- Sistem hesapları kullanıcı tarafından silinemez
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, code)
);

-- Indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);
CREATE INDEX idx_accounts_code ON accounts(code);

-- RLS Policies
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON accounts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create accounts" ON accounts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own accounts" ON accounts
    FOR UPDATE USING (user_id = auth.uid() AND is_system = false);

CREATE POLICY "Users can delete own accounts" ON accounts
    FOR DELETE USING (user_id = auth.uid() AND is_system = false);

-- Trigger
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Standart Hesap Planı için Function
CREATE OR REPLACE FUNCTION create_default_accounts(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Varlıklar (1xx)
    INSERT INTO accounts (user_id, code, name, type, is_system) VALUES
    (p_user_id, '100', 'KASA', 'asset', true),
    (p_user_id, '102', 'BANKALAR', 'asset', true),
    (p_user_id, '120', 'ALICILAR', 'asset', true),
    (p_user_id, '121', 'ALACAK SENETLERİ', 'asset', true),
    (p_user_id, '153', 'TİCARİ MALLAR', 'asset', true),

    -- Yükümlülükler (2xx)
    (p_user_id, '200', 'SATICILAR', 'liability', true),
    (p_user_id, '201', 'BORÇ SENETLERİ', 'liability', true),
    (p_user_id, '320', 'BANK KREDILERI', 'liability', true),
    (p_user_id, '360', 'ÖDENECEK VERGİ VE FONLAR', 'liability', true),

    -- Öz Sermaye (5xx)
    (p_user_id, '500', 'SERMAYE', 'equity', true),
    (p_user_id, '590', 'DÖNEM NET KARI', 'equity', true),
    (p_user_id, '591', 'DÖNEM NET ZARARI', 'equity', true),

    -- Gelirler (6xx)
    (p_user_id, '600', 'YURTİÇİ SATIŞLAR', 'income', true),
    (p_user_id, '601', 'YURTDIŞI SATIŞLAR', 'income', true),
    (p_user_id, '610', 'HİZMET GELİRLERİ', 'income', true),
    (p_user_id, '646', 'FAİZ GELİRLERİ', 'income', true),
    (p_user_id, '679', 'DİĞER OLAĞANDIŞI GELİRLER', 'income', true),

    -- Giderler (7xx)
    (p_user_id, '700', 'YURTİÇİ ALIMLAR', 'expense', true),
    (p_user_id, '701', 'YURTDIŞI ALIMLAR', 'expense', true),
    (p_user_id, '710', 'GENEL YÖNETİM GİDERLERİ', 'expense', true),
    (p_user_id, '720', 'PAZARLAMA GİDERLERİ', 'expense', true),
    (p_user_id, '770', 'KIRA GİDERLERİ', 'expense', true),
    (p_user_id, '780', 'FİNANSMAN GİDERLERİ', 'expense', true),
    (p_user_id, '789', 'DİĞER OLAĞANDIŞI GİDERLER', 'expense', true);
END;
$$ LANGUAGE plpgsql;
