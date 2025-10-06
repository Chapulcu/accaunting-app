# 🚀 Muhasebe Uygulaması - Kurulum Rehberi

## 📍 Durum: Database Schema Hazır

Projenin database şeması ve temel yapıları tamamlandı. Şimdi Supabase'de yeni proje oluşturmanız gerekiyor.

## ✅ Tamamlanan İşlemler

### 1. Proje Yapısı
- ✅ React 19 + TypeScript + Vite projesi oluşturuldu
- ✅ Tüm gerekli bağımlılıklar yüklendi
- ✅ Tailwind CSS yapılandırıldı
- ✅ Klasör yapısı hazırlandı

### 2. Database Migration Dosyaları
```
supabase/migrations/
├── 001_create_profiles.sql             ✅ Kullanıcı profilleri
├── 002_create_companies.sql            ✅ Cari hesaplar
├── 003_create_accounts.sql             ✅ Hesap planı
├── 004_create_invoices.sql             ✅ Faturalar
├── 005_create_banks_and_cash.sql       ✅ Banka/Kasa
├── 006_create_journal_entries.sql      ✅ Yevmiye kayıtları
├── 007_create_expenses_and_settings.sql ✅ Gider/Ayarlar
├── 010_create_chart_of_accounts.sql    ✅ Hesap planı genişletmesi
├── 012_create_email_history.sql        ✅ Email logları
├── 013_create_payments.sql             ✅ Ödeme yönetimi
├── 014_create_recurring_invoices.sql   ✅ Tekrarlayan faturalar
├── 019_create_products.sql             ✅ Ürün & stok
├── 021_complete_journal_and_chart_setup.sql ✅ Gelişmiş muhasebe fonksiyonları
├── 023_e_invoice_setup.sql             ✅ E-Fatura tabloları
├── 025_bank_api_integration.sql        ✅ Banka entegrasyonu altyapısı
└── 026_rbac_system.sql                 ✅ Rol & yetki tabanlı erişim
```

Ek olarak `supabase/scripts/` klasörü yardımcı SQL dosyalarını şu gruplarla saklar:

```
supabase/scripts/
├── maintenance/   # Veri düzeltme ve bakım scriptleri
├── setup/         # Hızlı kurulum / örnek veri scriptleri
└── utilities/     # Yönetici gibi tek seferlik işlemler
```

### 3. Supabase Client
- ✅ Supabase client yapılandırıldı ([src/lib/supabase.ts](src/lib/supabase.ts))
- ✅ TypeScript tipleri oluşturuldu ([src/types/database.ts](src/types/database.ts))
- ✅ React Query client hazırlandı

## 🔧 Sıradaki Adımlar

### ADIM 1: Supabase Projesi Oluştur

1. **Supabase'e git:** https://app.supabase.com
2. **"New Project" butonuna tıkla**
3. **Proje bilgileri:**
   - Name: `accounting-app` (veya istediğin isim)
   - Database Password: Güçlü bir şifre belirle
   - Region: `Frankfurt (eu-central-1)` veya yakın bölge
   - Pricing Plan: `Free` (başlangıç için yeterli)
4. **"Create new project" butonuna tıkla**
5. **Proje hazır olana kadar bekle (~2 dakika)**

### ADIM 2: API Keys'i Kopyala

1. Proje hazır olduğunda **Settings → API** menüsüne git
2. Şu bilgileri kopyala:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public:** `eyJhbGc...` (uzun token)

### ADIM 3: Environment Variables Güncelle

`.env` dosyasını aç ve güncelle:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### ADIM 4: Database Migration Çalıştır

#### Seçenek A — Supabase CLI (önerilen)
1. Terminalde proje klasörüne gidin
2. `supabase db push` komutunu çalıştırın (tüm migration'lar sırasıyla uygulanır)

#### Seçenek B — Supabase Dashboard
1. Supabase Dashboard → **SQL Editor** → "New Query"
2. `supabase/scripts/setup/combined_migrations.sql` dosyasının tamamını kopyalayın
3. Tek seferde çalıştırın; tüm tablolar, fonksiyonlar ve RLS politikaları oluşturulur

> 💡 İpucu: Geliştirme ortamında sıfırlama gerekiyorsa `supabase db reset` komutu tüm migration'ları yeniden çalıştırır.

### ADIM 5: Development Server Başlat

```bash
cd /Users/takhan/Documents/MUHASEBE/accounting-app
npm run dev
```

Tarayıcıda açılacak: `http://localhost:5173`

## 🎯 İlk Kullanıcı Kaydı

1. Uygulamayı aç
2. **Kayıt Ol** sayfasına git
3. Email ve şifre ile kayıt ol
4. Sistem otomatik olarak oluşturacak:
   - ✅ Standart hesap planı (100-Kasa, 102-Bankalar, vb.)
   - ✅ KDV oranları (%1, %8, %10, %18, %20)
   - ✅ Gider kategorileri (Kira, Maaş, Elektrik, vb.)
   - ✅ Uygulama ayarları

## 📊 Database Yapısı Özeti

### Ana Tablolar (özet)

1. **profiles** – Kullanıcı profilleri
2. **companies** – Cari hesaplar (müşteri/tedarikçi)
3. **accounts** & **chart_of_accounts** – Hesap planı
4. **invoices** & **invoice_items** – Faturalar ve satırları
5. **payments** – Ödemeler (kısmi/tam), **bank_transactions** & **cash_transactions**
6. **recurring_invoices** & **recurring_invoice_items** – Tekrarlayan faturalar
7. **products** & **product_categories** – Ürün ve stok yönetimi
8. **expenses** & **expense_categories** – Giderler ve kategorileri
9. **journal_entries** & **journal_entry_lines** – Muhasebe kayıtları
10. **exchange_rates** & **tax_rates** – Döviz ve KDV oranları
11. **email_history** – Gönderilen emailler
12. **e_invoice_settings**, **e_invoices**, **e_invoice_events** – E-Fatura altyapısı
13. **roles**, **permissions**, **user_roles** – RBAC
14. **approval_workflows**, **approval_workflow_steps**, **approval_requests**, **approval_history** – Onay süreçleri
15. **app_settings** – Uygulama genel ayarları

### Özel Özellikler:

- ✅ **Row Level Security (RLS):** Her kullanıcı sadece kendi verilerini görebilir
- ✅ **Otomatik Trigger'lar:**
  - Fatura toplamları otomatik hesaplanır
  - Banka/Kasa bakiyeleri otomatik güncellenir
  - Yevmiye borç/alacak toplamları otomatik hesaplanır
- ✅ **Standart Hesap Planı:** Türk Muhasebe Standardı'na uygun
- ✅ **Çoklu Döviz:** TRY, USD, EUR, GBP desteği
- ✅ **KDV Hesaplama:** Otomatik KDV ayrıştırma
- ✅ **RBAC & Onay:** Roller, izinler ve onay akışları için RLS + trigger kombinasyonu
- ✅ **Edge Functions:** TCMB döviz kurları ve email gönderimi için hazır fonksiyonlar

## 🔍 Database Doğrulama

Migration'lar tamamlandıktan sonra kontrol et:

1. **Supabase Dashboard → Table Editor**
2. Sol menüde şu tabloları görmelisin:
   - profiles, companies, accounts
   - invoices, invoice_items, payments
   - recurring_invoices, recurring_invoice_items
   - products, product_categories
   - expenses, expense_categories
   - journal_entries, journal_entry_lines
   - bank_accounts, bank_transactions, cash_registers, cash_transactions
   - exchange_rates, tax_rates
   - email_history
   - e_invoice_settings, e_invoices, e_invoice_events
   - roles, permissions, user_roles
   - approval_workflows, approval_requests, approval_history
   - app_settings

## 🐛 Sorun Giderme

### Hata: "Missing environment variables"
- `.env` dosyasının doğru yerde olduğundan emin ol
- Supabase URL ve Key'in doğru kopyalandığını kontrol et

### Hata: "relation does not exist"
- Migration dosyalarını sırayla çalıştırdığından emin ol
- SQL Editor'de hata mesajını kontrol et

### Hata: "RLS policy violation"
- Kullanıcı giriş yapmış olmalı
- Tablolarda RLS aktif ve policy'ler doğru kurulmalı

## 📞 Yardım

Sorun yaşarsan:
1. Supabase Dashboard → Logs → Error logs'u kontrol et
2. Browser Console (F12) → Hata mesajlarını kontrol et
3. GitHub Issues açabilirsin

---

**Hazırlayan:** Claude AI + Talip Akhan
**Tarih:** 2025-01-03
