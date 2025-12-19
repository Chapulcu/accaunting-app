# 👤 Admin Kullanıcısı Kurulum Rehberi

**Tarih:** 2025-12-10

---

## 📋 İçindekiler

1. [Hızlı Başlangıç](#hızlı-başlangıç)
2. [Manuel Kurulum](#manuel-kurulum)
3. [Script ile Kurulum](#script-ile-kurulum)
4. [Sorun Giderme](#sorun-giderme)

---

## 🚀 Hızlı Başlangıç

### Mevcut Admin Kullanıcısı

```
Email: admin@accounting.com
Şifre: Admin123!
Rol: admin
```

**Kullanım:**
1. Tarayıcıyı açın: `http://localhost:5173`
2. Giriş yapın
3. Tüm özelliklere erişim

---

## 🛠️ Manuel Kurulum

### Adım 1: Supabase Başlatma

```bash
supabase start
```

### Adım 2: Kullanıcı Oluşturma

```sql
-- Admin kullanıcısı oluştur
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Auth user oluştur
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
        raw_user_meta_data
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        gen_random_uuid(),
        'authenticated',
        'authenticated',
        'admin@accounting.com',
        crypt('Admin123!', gen_salt('bf', 10)),
        NOW(),
        '',  -- Boş string (NULL değil!)
        '',
        '',
        '',
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"full_name": "Admin User"}'::jsonb
    ) RETURNING id INTO v_user_id;

    -- Bekle (trigger'ın çalışması için)
    PERFORM pg_sleep(1);

    -- Profile'ı admin yap
    UPDATE profiles
    SET role = 'admin', company_name = 'Admin Company'
    WHERE id = v_user_id;

    RAISE NOTICE 'Admin kullanıcısı oluşturuldu: %', v_user_id;
END $$;
```

### Adım 3: Temel Verileri Oluşturma

```sql
-- Kullanıcı ID'sini al
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@accounting.com';

    -- Hesap planı
    PERFORM create_default_chart_of_accounts(v_user_id);

    -- KDV oranları
    PERFORM create_default_tax_rates(v_user_id);

    -- Gider kategorileri
    PERFORM create_default_expense_categories(v_user_id);

    -- Ürün kategorileri
    PERFORM create_default_product_categories(v_user_id);

    -- App settings
    INSERT INTO app_settings (user_id, company_name, email)
    VALUES (v_user_id, 'Admin Company', 'admin@accounting.com')
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Temel veriler oluşturuldu';
END $$;
```

### Adım 4: RBAC Kurulumu

```sql
-- Rolleri oluştur
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@accounting.com';

    -- Rolleri ekle
    INSERT INTO roles (user_id, name, description, is_system)
    VALUES
        (v_user_id, 'Admin', 'Sistem yöneticisi - tüm yetkiler', true),
        (v_user_id, 'Accountant', 'Muhasebe personeli - finansal işlemler', true),
        (v_user_id, 'Manager', 'Yönetici - onay ve raporlama', true),
        (v_user_id, 'User', 'Standart kullanıcı - temel işlemler', true)
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Admin rolüne tüm izinleri ata
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    CROSS JOIN permissions p
    WHERE r.name = 'Admin' AND r.user_id = v_user_id
    ON CONFLICT DO NOTHING;

    -- Kullanıcıya Admin rolünü ata
    INSERT INTO user_role_assignments (owner_user_id, assigned_user_id, role_id, assigned_by)
    SELECT v_user_id, v_user_id, r.id, v_user_id
    FROM roles r
    WHERE r.name = 'Admin' AND r.user_id = v_user_id
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'RBAC yapılandırıldı';
END $$;
```

---

## 📜 Script ile Kurulum

### Seçenek 1: SQL Script

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f scripts/create-admin.sql
```

**Dosya:** `scripts/create-admin.sql`

### Seçenek 2: Node.js Script (Basit)

```bash
node scripts/create-admin-simple.js [email] [password]
```

**Örnek:**
```bash
# Default değerlerle
node scripts/create-admin-simple.js

# Özel değerlerle
node scripts/create-admin-simple.js myemail@example.com MyPass123!
```

**Dosya:** `scripts/create-admin-simple.js`

### Seçenek 3: Node.js Script (İnteraktif)

```bash
node scripts/create-admin.js
```

Komut satırında size sorar:
- Email
- Şifre
- Ad Soyad

**Dosya:** `scripts/create-admin.js`

---

## 🔧 Sorun Giderme

### Sorun 1: "Database error querying schema"

**Sebep:** Token alanları NULL

**Çözüm:**
```sql
UPDATE auth.users
SET
    confirmation_token = '',
    recovery_token = '',
    email_change_token_new = '',
    email_change = ''
WHERE email = 'admin@accounting.com';
```

### Sorun 2: "Foreign key constraint violation"

**Sebep:** user_id geçersiz veya yoksa

**Çözüm:**
```sql
-- Önce kullanıcıyı kontrol et
SELECT id, email FROM auth.users WHERE email = 'admin@accounting.com';

-- Eğer yoksa, önce kullanıcıyı oluştur
-- Sonra rolleri oluştur
```

### Sorun 3: "Email already exists"

**Çözüm:**
```sql
-- Mevcut kullanıcıyı sil
DELETE FROM profiles WHERE email = 'admin@accounting.com';
DELETE FROM auth.users WHERE email = 'admin@accounting.com';

-- Sonra tekrar oluştur
```

### Sorun 4: RLS Politika Hatası (409 Conflict)

**Çözüm:** `docs/TROUBLESHOOTING.md` dosyasına bakın

---

## ✅ Doğrulama

### Kullanıcı Kontrolü:
```sql
SELECT
    u.id,
    u.email,
    u.email_confirmed_at,
    p.role,
    p.full_name,
    p.company_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email = 'admin@accounting.com';
```

### Veri Kontrolü:
```sql
SELECT
    'Hesap Planı: ' || COUNT(*) FROM chart_of_accounts WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com')
UNION ALL
SELECT 'KDV Oranları: ' || COUNT(*) FROM tax_rates WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com')
UNION ALL
SELECT 'Gider Kategorileri: ' || COUNT(*) FROM expense_categories WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com')
UNION ALL
SELECT 'Ürün Kategorileri: ' || COUNT(*) FROM product_categories WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com')
UNION ALL
SELECT 'Roller: ' || COUNT(*) FROM roles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com')
UNION ALL
SELECT 'İzinler: ' || COUNT(*) FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE r.name = 'Admin' AND r.user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com');
```

**Beklenen Sonuç:**
```
Hesap Planı: 36
KDV Oranları: 5
Gider Kategorileri: 11
Ürün Kategorileri: 5
Roller: 4
İzinler: 23
```

---

## 🔑 Şifre Değiştirme

### Manuel SQL ile:
```sql
UPDATE auth.users
SET encrypted_password = crypt('YeniSifre123!', gen_salt('bf', 10))
WHERE email = 'admin@accounting.com';
```

### Uygulama Üzerinden:
1. Giriş yapın
2. Ayarlar → Profil
3. Şifre Değiştir

---

## 📝 Notlar

### Önemli Hatırlatmalar:

1. **Token Alanları:** Mutlaka boş string (`''`) olmalı, NULL olmamalı
2. **bcrypt Salt:** `gen_salt('bf', 10)` kullanın (10 rounds)
3. **Email Confirmed:** `email_confirmed_at` NULL olmamalı
4. **RLS Politikaları:** WITH CHECK clause mutlaka olmalı
5. **Trigger Beklemesi:** Profile oluşturulduktan sonra 1 saniye bekleyin

### Güvenlik:

- ⚠️ Production'da güçlü şifre kullanın
- ⚠️ Default şifreyi değiştirin
- ⚠️ Admin hesabını sınırlı kullanın
- ⚠️ İşlem loglarını takip edin

---

**Son Güncelleme:** 2025-12-10
**Durum:** ✅ Test Edildi ve Çalışıyor
