# 🔧 Sorun Giderme Kılavuzu

**Tarih:** 2025-12-10

---

## 📋 İçindekiler

1. [Auth Hataları](#auth-hataları)
2. [Database Hataları](#database-hataları)
3. [RLS Politika Hataları](#rls-politika-hataları)
4. [Frontend Hataları](#frontend-hataları)
5. [Supabase Hataları](#supabase-hataları)

---

## 🔐 Auth Hataları

### Hata: "Database error querying schema"

**Tam Hata:**
```
AuthApiError: Database error querying schema
sql: Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported
```

**Sebep:**
Supabase Auth, `confirmation_token` gibi alanların NULL olmasını kabul etmiyor. Boş string olmalı.

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

**Kontrol:**
```sql
SELECT
    email,
    confirmation_token,
    recovery_token,
    email_confirmed_at
FROM auth.users
WHERE email = 'admin@accounting.com';
```

---

### Hata: "Invalid login credentials"

**Sebep:**
- Şifre yanlış hash'lenmiş
- Şifre doğru girilmemiş
- Kullanıcı mevcut değil

**Çözüm 1: Şifreyi Sıfırlama**
```sql
UPDATE auth.users
SET encrypted_password = crypt('Admin123!', gen_salt('bf', 10))
WHERE email = 'admin@accounting.com';
```

**Çözüm 2: Kullanıcıyı Kontrol Etme**
```sql
SELECT id, email, email_confirmed_at, encrypted_password
FROM auth.users
WHERE email = 'admin@accounting.com';
```

**Çözüm 3: Yeni Kullanıcı Oluşturma**
Eğer kullanıcı yoksa, `docs/ADMIN_SETUP.md` dosyasına bakın.

---

### Hata: "Email not confirmed"

**Sebep:** `email_confirmed_at` NULL

**Çözüm:**
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@accounting.com';
```

---

## 💾 Database Hataları

### Hata: "Foreign key constraint violation" (roles tablosu)

**Tam Hata:**
```
ERROR: insert or update on table "roles" violates foreign key constraint "roles_user_id_fkey"
DETAIL: Key (user_id)=(xxx) is not present in table "users"
```

**Sebep:**
- user_id geçersiz
- Kullanıcı auth.users tablosunda yok

**Çözüm 1: Kullanıcıyı Kontrol Et**
```sql
SELECT id FROM auth.users WHERE email = 'admin@accounting.com';
```

**Çözüm 2: Doğru user_id Kullan**
Frontend'de `user?.id` kontrolü yapın:
```typescript
if (!user?.id) {
  throw new Error('Kullanıcı bilgisi yüklenemedi')
}
```

---

### Hata: "Unique constraint violation" (app_settings)

**Tam Hata:**
```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Sebep:** Unique constraint eksik

**Çözüm:**
```sql
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_user_id_key UNIQUE (user_id);
```

---

### Hata: "Unique constraint violation" (product_categories)

**Sebep:** `(user_id, name)` için unique constraint eksik

**Çözüm:**
```sql
ALTER TABLE product_categories
ADD CONSTRAINT product_categories_user_id_name_key UNIQUE (user_id, name);
```

---

## 🔒 RLS Politika Hataları

### Hata: 409 Conflict (roles tablosu)

**Sebep:** RLS politikasında WITH CHECK clause eksik

**Çözüm:**
```sql
-- Mevcut politikayı sil
DROP POLICY IF EXISTS "Users can manage own roles" ON roles;

-- Yeni politikalar oluştur
CREATE POLICY "Users can view own roles" ON roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles" ON roles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles" ON roles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own roles" ON roles
    FOR DELETE USING (auth.uid() = user_id);
```

---

### Hata: 409 Conflict (role_permissions tablosu)

**Çözüm:**
```sql
DROP POLICY IF EXISTS "Users can manage role permissions for own roles" ON role_permissions;

CREATE POLICY "Users can view role permissions for own roles" ON role_permissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
              AND roles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert role permissions for own roles" ON role_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
              AND roles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update role permissions for own roles" ON role_permissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
              AND roles.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
              AND roles.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete role permissions for own roles" ON role_permissions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
              AND roles.user_id = auth.uid()
        )
    );
```

---

### Hata: 409 Conflict (user_role_assignments)

**Sebep:** Alan isimleri yanlış (user_id yerine owner_user_id/assigned_user_id)

**Çözüm:**
```sql
DROP POLICY IF EXISTS "Users can manage role assignments" ON user_role_assignments;

CREATE POLICY "Users can view own role assignments" ON user_role_assignments
    FOR SELECT USING (auth.uid() = owner_user_id OR auth.uid() = assigned_user_id);

CREATE POLICY "Users can insert own role assignments" ON user_role_assignments
    FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own role assignments" ON user_role_assignments
    FOR UPDATE
    USING (auth.uid() = owner_user_id)
    WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can delete own role assignments" ON user_role_assignments
    FOR DELETE USING (auth.uid() = owner_user_id);
```

---

## 🌐 Frontend Hataları

### Hata: "User not authenticated" / user.id undefined

**Sebep:** Auth context henüz yüklenmemiş

**Çözüm:** Null check ekleyin
```typescript
// RolesPermissions.tsx
const createDefaultMutation = useMutation({
  mutationFn: async () => {
    if (!user?.id) {
      throw new Error('Kullanıcı bilgisi yüklenemedi. Lütfen sayfayı yenileyin.')
    }
    await RBACService.createDefaultRoles(user.id)
  }
})
```

---

### Hata: "FrameIsBrowserFrameError" (Console)

**Sebep:** Tarayıcı eklentisi hatası (LastPass, Grammarly, etc.)

**Çözüm:**
- ✅ Yoksayın (zararsız)
- ✅ Console filtresine `-background.js` ekleyin
- ⚠️ Veya eklentileri devre dışı bırakın

---

### Hata: "Unchecked runtime.lastError"

**Sebep:** Tarayıcı eklentisi hatası

**Çözüm:** Yoksayın (uygulama ile ilgili değil)

---

## 🐳 Supabase Hataları

### Hata: "Container is not running: exited"

**Çözüm:**
```bash
supabase stop
supabase start
```

---

### Hata: "Port already in use"

**Çözüm 1: Port'u Kontrol Et**
```bash
lsof -i :54321
lsof -i :54322
lsof -i :54323
```

**Çözüm 2: Process'i Öldür**
```bash
kill -9 <PID>
```

**Çözüm 3: Supabase'i Yeniden Başlat**
```bash
supabase stop
supabase start
```

---

### Hata: "Database reset failed"

**Çözüm:**
```bash
# Volumes'ları temizle
docker volume ls --filter label=com.supabase.cli.project=accounting-app
docker volume rm $(docker volume ls -q --filter label=com.supabase.cli.project=accounting-app)

# Yeniden başlat
supabase stop
supabase start
```

---

### Hata: "Schema cache error"

**Çözüm:**
```bash
# Supabase'i yeniden başlat
supabase stop
supabase db reset
supabase start
```

---

## 🔍 Log İnceleme

### Database Logs:
```bash
docker logs supabase_db_accounting-app 2>&1 | tail -50
docker logs supabase_db_accounting-app 2>&1 | grep -i "error"
```

### Auth Logs:
```bash
docker logs supabase_auth_accounting-app 2>&1 | tail -50
docker logs supabase_auth_accounting-app 2>&1 | grep -i "error"
```

### REST API Logs:
```bash
docker logs supabase_rest_accounting-app 2>&1 | tail -20
```

---

## 🧪 Test Komutları

### Kullanıcıyı Test Et:
```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@accounting.com",
    "password": "Admin123!"
  }'
```

### RLS'i Test Et:
```sql
SET LOCAL role TO authenticator;
SET LOCAL request.jwt.claims TO '{"sub": "USER_ID", "role": "authenticated"}';

SELECT * FROM roles LIMIT 5;
```

---

## 💡 Genel Öneriler

### 1. Tarayıcıyı Temizle
- Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- Cache temizle
- Private/Incognito mode dene

### 2. Database'i Kontrol Et
```sql
-- Kullanıcı var mı?
SELECT * FROM auth.users WHERE email = 'admin@accounting.com';

-- Profile var mı?
SELECT * FROM profiles WHERE email = 'admin@accounting.com';

-- Veriler oluşturulmuş mu?
SELECT COUNT(*) FROM chart_of_accounts WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com');
```

### 3. Supabase'i Yeniden Başlat
```bash
supabase stop
supabase start
```

### 4. Logları İncele
Her zaman logları kontrol edin - hatanın gerçek sebebini gösterir.

---

## 📞 Yardım Alma

Eğer sorun devam ediyorsa:

1. **Log'ları toplayın:**
   - Database logs
   - Auth logs
   - Browser console logs

2. **Durumu kaydedin:**
   - Hangi işlemi yapıyordunuz?
   - Hata mesajı tam olarak ne?
   - Hangi adımları denediniz?

3. **İletişim:**
   - GitHub Issues: [proje-repo]/issues
   - Email: akhantalip@gmail.com

---

**Son Güncelleme:** 2025-12-10
**Durum:** ✅ Aktif
