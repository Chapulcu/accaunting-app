-- Profiles tablosuna INSERT politikası ekle
-- Yeni kullanıcı kaydı sırasında profile oluşturulabilmesi için

-- Mevcut INSERT politikasını sil (varsa)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Yeni INSERT politikası ekle
-- Trigger tarafından otomatik oluşturulabilmesi için
CREATE POLICY "Enable insert for new users" ON profiles
    FOR INSERT
    WITH CHECK (true);

-- Alternatif: Sadece kendi profile'ını oluşturabilsin
-- CREATE POLICY "Users can insert own profile" ON profiles
--     FOR INSERT
--     WITH CHECK (auth.uid() = id);

-- Log için notification
DO $$
BEGIN
    RAISE NOTICE 'Profiles INSERT policy created successfully';
END $$;
