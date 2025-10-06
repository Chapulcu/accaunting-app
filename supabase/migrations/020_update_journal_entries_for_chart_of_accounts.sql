-- Journal Entries tablosunu chart_of_accounts ile uyumlu hale getir

-- 1. journal_entry_lines tablosu varsa ve account_id INTEGER ise, sil ve yeniden oluştur
DROP TABLE IF EXISTS journal_entry_lines CASCADE;

-- journal_entry_lines tablosunu UUID ile yeniden oluştur
CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit = 0 OR credit = 0)
);

-- Indexes
CREATE INDEX idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);

-- RLS Policies - Journal Entry Lines
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entry lines" ON journal_entry_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create journal entry lines" ON journal_entry_lines
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can update journal entry lines" ON journal_entry_lines
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

CREATE POLICY "Users can delete journal entry lines" ON journal_entry_lines
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM journal_entries
            WHERE journal_entries.id = journal_entry_lines.journal_entry_id
            AND journal_entries.user_id = auth.uid()
            AND journal_entries.status = 'draft'
        )
    );

-- Trigger
CREATE TRIGGER update_journal_entry_lines_updated_at
    BEFORE UPDATE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. account_balances view'ını güncelle
DROP VIEW IF EXISTS account_balances;

CREATE OR REPLACE VIEW account_balances AS
SELECT
    a.id,
    a.user_id,
    a.code,
    a.name,
    a.account_type as type,
    COALESCE(SUM(jel.debit), 0) as total_debit,
    COALESCE(SUM(jel.credit), 0) as total_credit,
    CASE
        WHEN a.account_type IN ('asset', 'expense') THEN COALESCE(SUM(jel.debit - jel.credit), 0)
        WHEN a.account_type IN ('liability', 'equity', 'revenue') THEN COALESCE(SUM(jel.credit - jel.debit), 0)
    END as balance
FROM chart_of_accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE a.is_active = true
GROUP BY a.id, a.user_id, a.code, a.name, a.account_type;

-- 3. Varsayılan hesap planı oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Varlıklar (1xx)
    INSERT INTO chart_of_accounts (user_id, code, name, account_type, description) VALUES
    (p_user_id, '100', 'KASA', 'asset', 'Nakit para'),
    (p_user_id, '102', 'BANKALAR', 'asset', 'Banka hesapları'),
    (p_user_id, '120', 'ALICILAR', 'asset', 'Müşterilerden alacaklar'),
    (p_user_id, '121', 'ALACAK SENETLERİ', 'asset', 'Senetli alacaklar'),
    (p_user_id, '153', 'TİCARİ MALLAR', 'asset', 'Satılmak üzere alınan mallar'),
    (p_user_id, '180', 'GELECEK AYLARA AİT GİDERLER', 'asset', 'Peşin ödenen giderler'),
    (p_user_id, '191', 'İNDİRİLECEK KDV', 'asset', 'Alışlardaki KDV'),

    -- Kısa Vadeli Yükümlülükler (3xx)
    (p_user_id, '320', 'SATICILAR', 'liability', 'Satıcılara borçlar'),
    (p_user_id, '321', 'BORÇ SENETLERİ', 'liability', 'Senetli borçlar'),
    (p_user_id, '360', 'ÖDENECEK VERGİ VE FONLAR', 'liability', 'Vergi dairesi borçları'),
    (p_user_id, '391', 'HESAPLANAN KDV', 'liability', 'Satışlardaki KDV'),

    -- Uzun Vadeli Yükümlülükler (4xx)
    (p_user_id, '400', 'BANKA KREDİLERİ', 'liability', 'Uzun vadeli kredi borçları'),

    -- Öz Sermaye (5xx)
    (p_user_id, '500', 'SERMAYE', 'equity', 'Şirket sermayesi'),
    (p_user_id, '540', 'GEÇMİŞ YILLAR KARLARI', 'equity', 'Dağıtılmamış karlar'),
    (p_user_id, '570', 'GEÇMİŞ YILLAR ZARARLARI', 'equity', 'Geçmiş dönem zararları'),
    (p_user_id, '590', 'DÖNEM NET KARI', 'equity', 'Cari dönem karı'),
    (p_user_id, '591', 'DÖNEM NET ZARARI', 'equity', 'Cari dönem zararı'),

    -- Gelirler (6xx)
    (p_user_id, '600', 'YURTİÇİ SATIŞLAR', 'revenue', 'Türkiye içi satışlar'),
    (p_user_id, '601', 'YURTDIŞI SATIŞLAR', 'revenue', 'İhracat satışları'),
    (p_user_id, '602', 'DİĞER GELİRLER', 'revenue', 'Yan gelirler'),
    (p_user_id, '610', 'HİZMET GELİRLERİ', 'revenue', 'Hizmet satışları'),
    (p_user_id, '646', 'FAİZ GELİRLERİ', 'revenue', 'Faiz ve vade farkı gelirleri'),
    (p_user_id, '656', 'KAMBİYO KARLARI', 'revenue', 'Döviz kuru karları'),
    (p_user_id, '679', 'DİĞER OLAĞANDIŞI GELİRLER', 'revenue', 'Olağandışı gelirler'),

    -- Giderler (7xx)
    (p_user_id, '700', 'YURTİÇİ ALIMLAR', 'expense', 'Türkiye içi alımlar'),
    (p_user_id, '701', 'YURTDIŞI ALIMLAR', 'expense', 'İthalat'),
    (p_user_id, '710', 'DİREKT İŞÇİLİK GİDERLERİ', 'expense', 'Maaş ve ücretler'),
    (p_user_id, '720', 'GENEL ÜRETİM GİDERLERİ', 'expense', 'Üretim giderleri'),
    (p_user_id, '730', 'GENEL YÖNETİM GİDERLERİ', 'expense', 'Yönetim giderleri'),
    (p_user_id, '740', 'PAZARLAMA SATIŞ VE DAĞITIM GİDERLERİ', 'expense', 'Satış giderleri'),
    (p_user_id, '750', 'ARAŞTIRMA VE GELİŞTİRME GİDERLERİ', 'expense', 'Ar-Ge harcamaları'),
    (p_user_id, '760', 'FİNANSMAN GİDERLERİ', 'expense', 'Faiz ve vade farkı giderleri'),
    (p_user_id, '770', 'KİRA GİDERLERİ', 'expense', 'Kira ödemeleri'),
    (p_user_id, '780', 'AMORTİSMAN VE TÜKENME PAYLARI', 'expense', 'Amortisman giderleri'),
    (p_user_id, '789', 'DİĞER OLAĞANDIŞI GİDERLER', 'expense', 'Olağandışı giderler'),
    (p_user_id, '796', 'KAMBİYO ZARARLARI', 'expense', 'Döviz kuru zararları');

END;
$$ LANGUAGE plpgsql;

-- 4. Yeni kullanıcılar için otomatik hesap planı oluşturma trigger'ı
CREATE OR REPLACE FUNCTION create_chart_of_accounts_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM create_default_chart_of_accounts(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Yeni kullanıcı kaydında otomatik hesap planı oluştur
-- Not: Bu trigger auth.users tablosuna eklenmeli, ancak Supabase'de bu
-- genellikle profiller tablosunda yapılır. Kullanıcı yönetimi için
-- profiles tablosuna benzer bir trigger eklenebilir.

COMMENT ON FUNCTION create_default_chart_of_accounts IS 'Yeni kullanıcı için varsayılan Türk Tekdüzen Hesap Planı oluşturur';

-- 5. Yevmiye toplamlarını otomatik hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION calculate_journal_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_total_debit DECIMAL(15,2);
    v_total_credit DECIMAL(15,2);
BEGIN
    -- journal_entry_id'yi belirle (INSERT, UPDATE veya DELETE)
    IF TG_OP = 'DELETE' THEN
        -- Toplam borç ve alacak hesapla
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO v_total_debit, v_total_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = OLD.journal_entry_id;

        -- Yevmiye toplamlarını güncelle
        UPDATE journal_entries
        SET
            total_debit = v_total_debit,
            total_credit = v_total_credit
        WHERE id = OLD.journal_entry_id;

        RETURN OLD;
    ELSE
        -- Toplam borç ve alacak hesapla
        SELECT
            COALESCE(SUM(debit), 0),
            COALESCE(SUM(credit), 0)
        INTO v_total_debit, v_total_credit
        FROM journal_entry_lines
        WHERE journal_entry_id = NEW.journal_entry_id;

        -- Yevmiye toplamlarını güncelle
        UPDATE journal_entries
        SET
            total_debit = v_total_debit,
            total_credit = v_total_credit
        WHERE id = NEW.journal_entry_id;

        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journal_totals
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION calculate_journal_totals();
