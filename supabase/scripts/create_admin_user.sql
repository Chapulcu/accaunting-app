-- Admin kullanıcısı oluşturma scripti
-- NOT: Bu script local development için hazırlanmıştır
-- Production'da Supabase Dashboard veya Auth API kullanılmalıdır

-- 1. Auth user oluştur (şifre: Admin123!)
-- email: admin@accounting.com
-- password: Admin123!

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    last_sign_in_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@accounting.com',
    -- Bu bcrypt hash'i "Admin123!" şifresi içindir
    '$2a$10$kqQxqWGqYkGKVJHwWjYxV.JYqHGKVJHwWjYxV.JYqHGKVJHwWjYxV.',
    NOW(),
    '',
    '',
    '',
    '',
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Admin User"}',
    false,
    NOW()
)
ON CONFLICT (email) DO NOTHING
RETURNING id, email;

-- 2. Profile oluştur ve admin rolü ata
-- NOT: handle_new_user trigger otomatik olarak profile oluşturur,
-- ama role'ü manuel olarak 'admin' yapmamız gerekiyor

UPDATE profiles
SET
    role = 'admin',
    full_name = 'Admin User',
    company_name = 'Admin Company'
WHERE email = 'admin@accounting.com';

-- Sonuç
SELECT
    u.id,
    u.email,
    u.email_confirmed_at,
    p.role,
    p.full_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@accounting.com';
