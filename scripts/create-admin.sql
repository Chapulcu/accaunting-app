-- Admin kullanıcısı oluşturma SQL scripti
-- Bu script'i psql ile çalıştırın:
-- psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/create-admin.sql

-- 1. pgcrypto extension'ı etkinleştir (şifre hashleme için)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Admin kullanıcısı oluştur
DO $$
DECLARE
    v_user_id UUID;
    v_encrypted_password TEXT;
    v_existing_user_id UUID;
BEGIN
    -- Şifreyi hashle (Admin123!)
    v_encrypted_password := crypt('Admin123!', gen_salt('bf'));

    -- Mevcut kullanıcıyı kontrol et
    SELECT id INTO v_existing_user_id
    FROM auth.users
    WHERE email = 'admin@accounting.com';

    IF v_existing_user_id IS NOT NULL THEN
        -- Kullanıcı zaten var, şifresini güncelle
        UPDATE auth.users
        SET
            encrypted_password = v_encrypted_password,
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = v_existing_user_id;

        -- Profile'ı admin yap
        UPDATE public.profiles
        SET
            role = 'admin',
            full_name = 'Admin User',
            company_name = 'Admin Company',
            updated_at = NOW()
        WHERE id = v_existing_user_id;

        RAISE NOTICE '✅ Mevcut kullanıcı güncellendi ve admin yapıldı!';
        RAISE NOTICE 'Email: admin@accounting.com';
        RAISE NOTICE 'Yeni Şifre: Admin123!';
        RAISE NOTICE 'User ID: %', v_existing_user_id;
    ELSE
        -- Yeni kullanıcı oluştur
        v_user_id := gen_random_uuid();

        -- Auth user ekle
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
            last_sign_in_at,
            confirmation_sent_at
        )
        VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            'admin@accounting.com',
            v_encrypted_password,
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
            NOW(),
            NOW()
        );

        -- Profile oluştur
        INSERT INTO public.profiles (id, email, full_name, role, company_name)
        VALUES (
            v_user_id,
            'admin@accounting.com',
            'Admin User',
            'admin',
            'Admin Company'
        );

        RAISE NOTICE '✅ Admin kullanıcısı başarıyla oluşturuldu!';
        RAISE NOTICE 'Email: admin@accounting.com';
        RAISE NOTICE 'Şifre: Admin123!';
        RAISE NOTICE 'User ID: %', v_user_id;
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Hata: %', SQLERRM;
END $$;

-- 3. Sonucu kontrol et
SELECT
    u.id,
    u.email,
    u.email_confirmed_at,
    p.role,
    p.full_name,
    p.company_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'admin@accounting.com';
