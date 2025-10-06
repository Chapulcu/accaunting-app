-- 1. Önce auth.users'daki kullanıcıları görelim
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Profiles tablosundaki kullanıcıları görelim
SELECT id, email, full_name, role, created_at
FROM profiles
ORDER BY created_at DESC;

-- 3. Auth'da olup profiles'da olmayan kullanıcıları bulalım
SELECT u.id, u.email, u.raw_user_meta_data->>'full_name' as full_name
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 4. Eksik profilleri manuel olarak oluştur
INSERT INTO profiles (id, email, full_name, role)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email) as full_name,
    'user' as role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- 5. Trigger'ın çalışıp çalışmadığını kontrol et
SELECT
    t.tgname as trigger_name,
    c.relname as table_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';
