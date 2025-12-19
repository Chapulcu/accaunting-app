# 📚 Muhasebe Uygulaması - Kapsamlı Dokümantasyon

**Versiyon:** 1.3.0
**Son Güncelleme:** 2025-01-18
**Geliştirici:** Talip Akhan

---

## 📑 İçindekiler

1. [Proje Genel Bakış](#proje-genel-bakış)
2. [Teknoloji Stack](#teknoloji-stack)
3. [Mimari Yapı](#mimari-yapı)
4. [Kurulum ve Yapılandırma](#kurulum-ve-yapılandırma)
5. [Admin Kullanıcı Oluşturma](#admin-kullanıcı-oluşturma)
6. [Özellikler](#özellikler)
7. [Kullanım Kılavuzu](#kullanım-kılavuzu)
8. [TCMB Döviz Kurları Deployment](#tcmb-döviz-kurları-deployment)
9. [Sorun Giderme](#sorun-giderme)
10. [API ve Servisler](#api-ve-servisler)

---

## 🎯 Proje Genel Bakış

Bu uygulama, küçük ve orta ölçekli işletmeler için tasarlanmış, modern ve kullanıcı dostu bir muhasebe yazılımıdır.

### Temel Özellikler
- ✅ Çift taraflı kayıt sistemi (Borç/Alacak)
- ✅ Fatura yönetimi (Satış/Alış)
- ✅ Cari hesap takibi
- ✅ Ödeme yönetimi (kısmi ödeme desteği)
- ✅ Gider takibi
- ✅ Ürün ve stok yönetimi
- ✅ Tekrarlayan faturalar
- ✅ Kapsamlı raporlama (Bilanço, Mizan, Gelir Tablosu, vb.)
- ✅ PDF fatura oluşturma
- ✅ E-posta entegrasyonu
- ✅ Çoklu para birimi desteği (TRY, USD, EUR, GBP)
- ✅ TCMB döviz kuru entegrasyonu
- ✅ Rol tabanlı erişim kontrolü (RBAC)
- ✅ E-Fatura altyapısı
- ✅ Dark mode desteği

---

## 💻 Teknoloji Stack

### Frontend
- **React 19.1.1** - Modern UI framework
- **TypeScript 5.9.3** - Tip güvenli geliştirme
- **Vite 7.1.7** - Hızlı build ve geliştirme
- **React Router 7.9.3** - Client-side routing
- **TanStack Query 5.90.2** - Veri yönetimi ve önbellekleme
- **Tailwind CSS 3.4.18** - Utility-first CSS
- **Framer Motion 12.23.22** - Animasyonlar
- **Lucide React** - İkon kütüphanesi
- **Recharts 3.2.1** - Grafik ve analitik

### Backend & Veritabanı
- **Supabase** - Backend-as-a-Service
  - PostgreSQL veritabanı
  - JWT authentication
  - Row Level Security (RLS)
  - Edge Functions
  - Real-time subscriptions
- **PostgreSQL** - İlişkisel veritabanı

### Veri İşleme & Export
- **jsPDF + jspdf-autotable** - PDF oluşturma
- **XLSX 0.18.5** - Excel export/import
- **i18next** - Çoklu dil desteği

### Geliştirme Araçları
- **ESLint 9.36.0** - Kod kalitesi
- **TypeScript ESLint** - TypeScript linting
- **PostCSS + Autoprefixer** - CSS işleme

---

## 🏗️ Mimari Yapı

### Klasör Yapısı

```
accounting-app/
├── src/
│   ├── components/          # UI bileşenleri
│   │   ├── Layout.tsx       # Ana layout ve navigasyon
│   │   ├── ProtectedRoute.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Pagination.tsx
│   │   └── Tooltip.tsx
│   │
│   ├── pages/               # Sayfa bileşenleri (23 sayfa)
│   │   ├── Dashboard.tsx
│   │   ├── Invoices.tsx, Payments.tsx
│   │   ├── RecurringInvoices.tsx
│   │   ├── Customers.tsx, Products.tsx
│   │   ├── Expenses.tsx
│   │   ├── Accounts.tsx, JournalEntries.tsx
│   │   ├── reports/         # Raporlar
│   │   │   ├── IncomeStatement.tsx
│   │   │   ├── BalanceSheet.tsx
│   │   │   ├── TrialBalance.tsx
│   │   │   ├── CustomerAccountSummary.tsx
│   │   │   ├── VatDeclaration.tsx
│   │   │   └── AgingAnalysis.tsx
│   │   ├── BankAccounts.tsx
│   │   ├── EmailHistory.tsx
│   │   ├── Settings.tsx
│   │   ├── RolesPermissions.tsx
│   │   └── ...
│   │
│   ├── contexts/            # React Context
│   │   └── AuthContext.tsx  # Kimlik doğrulama
│   │
│   ├── services/            # İş mantığı
│   │   ├── rbacService.ts
│   │   ├── eInvoiceService.ts
│   │   ├── approvalService.ts
│   │   ├── bankApiService.ts
│   │   ├── exchangeRate.ts
│   │   └── email.ts
│   │
│   ├── lib/                 # Yardımcı fonksiyonlar
│   │   ├── supabase.ts      # Supabase client
│   │   ├── currency.ts
│   │   ├── validation.ts
│   │   ├── journalEntryHelper.ts
│   │   ├── excelExport.ts
│   │   ├── pdf.ts
│   │   └── queryClient.ts
│   │
│   ├── types/
│   │   └── database.ts      # TypeScript tipleri
│   │
│   ├── utils/
│   │   └── error.ts
│   │
│   ├── App.tsx              # Ana router
│   └── main.tsx             # Entry point
│
├── supabase/
│   ├── migrations/          # Veritabanı migration'ları (26 dosya)
│   ├── functions/           # Edge Functions
│   │   ├── fetch-tcmb-rates/
│   │   └── send-email/
│   └── scripts/             # Yardımcı scriptler
│
├── docs/                    # Dokümantasyon
├── public/                  # Statik dosyalar
└── scripts/                 # Yönetim scriptleri
```

### Veritabanı Yapısı

#### Ana Tablolar
1. **profiles** - Kullanıcı profilleri ve rolleri
2. **companies** - Cari hesaplar (müşteri/tedarikçi)
3. **accounts** & **chart_of_accounts** - Hesap planı
4. **invoices** & **invoice_items** - Faturalar
5. **payments** - Ödemeler
6. **recurring_invoices** - Tekrarlayan faturalar
7. **products** & **product_categories** - Ürün yönetimi
8. **expenses** & **expense_categories** - Gider takibi
9. **journal_entries** & **journal_entry_lines** - Yevmiye kayıtları
10. **bank_accounts** & **bank_transactions** - Banka işlemleri
11. **cash_registers** & **cash_transactions** - Kasa işlemleri
12. **exchange_rates** & **tax_rates** - Döviz ve KDV
13. **email_history** - E-posta kayıtları
14. **e_invoice_settings** & **e_invoices** - E-Fatura
15. **roles**, **permissions**, **role_permissions** - RBAC
16. **approval_workflows** - Onay süreçleri
17. **app_settings** - Uygulama ayarları

#### Güvenlik
- **Row Level Security (RLS):** Her kullanıcı sadece kendi verilerine erişir
- **JWT Authentication:** Güvenli token tabanlı kimlik doğrulama
- **Otomatik Trigger'lar:** Veri bütünlüğü ve hesaplamalar

### State Yönetimi

#### 1. React Context API
- Merkezi kimlik doğrulama (AuthContext)
- User session yönetimi

#### 2. TanStack Query
- Ana veri çekme stratejisi
- 5 dakika önbellekleme
- Otomatik yeniden çekme
- `useQuery()` - okuma, `useMutation()` - yazma

#### 3. Component Local State
- Form state'leri
- UI durumları (modal, pagination, filter)

### Routing Yapısı

```
/ (Protected)
├── /dashboard
├── /customers
├── /invoices
├── /recurring-invoices
├── /payments
├── /expenses
├── /products
├── /exchange-rates
├── /accounts
├── /journal-entries
├── /reports
│   ├── /reports/income-statement
│   ├── /reports/balance-sheet
│   ├── /reports/trial-balance
│   ├── /reports/customer-account-summary
│   ├── /reports/vat-declaration
│   └── /reports/aging-analysis
├── /email-history
├── /e-invoice-settings
├── /e-invoices
├── /bank-accounts
├── /roles-permissions
├── /approval-workflows
└── /settings
```

---

## 🚀 Kurulum ve Yapılandırma

### Ön Koşullar
- Node.js 18+ ve npm
- Supabase hesabı
- Git

### 1. Projeyi Klonlama

```bash
git clone <repository-url>
cd accounting-app
```

### 2. Bağımlılıkları Kurma

```bash
npm install
```

### 3. Supabase Projesi Oluşturma

1. https://app.supabase.com adresine gidin
2. "New Project" butonuna tıklayın
3. Proje bilgilerini girin:
   - Name: `accounting-app`
   - Database Password: Güçlü bir şifre
   - Region: `Europe (Frankfurt)` veya size yakın
   - Pricing Plan: `Free`
4. "Create new project" butonuna tıklayın
5. Proje hazır olana kadar bekleyin (~2 dakika)

### 4. API Keys'i Alma

1. Supabase Dashboard → Settings → API
2. Şu bilgileri kopyalayın:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** `eyJhbGc...` (uzun token)

### 5. Environment Variables Ayarlama

Proje kökünde `.env` dosyası oluşturun:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 6. Database Migration'larını Çalıştırma

#### Seçenek A: Supabase CLI (Önerilen)

```bash
# Supabase CLI kurulumu
npm install -g supabase

# Supabase'e giriş
supabase login

# Projeyi bağla
supabase link --project-ref your-project-ref

# Migration'ları çalıştır
supabase db push
```

#### Seçenek B: Supabase Dashboard

1. Supabase Dashboard → SQL Editor → "New Query"
2. `supabase/migrations/` klasöründeki dosyaları sırayla çalıştırın
3. Her migration'dan sonra "Run" butonuna basın

### 7. Development Server'ı Başlatma

```bash
npm run dev
```

Tarayıcınızda `http://localhost:5173` adresini açın.

### 8. İlk Kullanıcı Kaydı

1. Uygulamayı açın
2. "Kayıt Ol" sayfasına gidin
3. Email ve şifre ile kayıt olun
4. Sistem otomatik olarak oluşturacak:
   - Standart hesap planı (36 hesap)
   - KDV oranları (5 oran)
   - Gider kategorileri (11 kategori)
   - Ürün kategorileri (5 kategori)
   - Uygulama ayarları

---

## 👤 Admin Kullanıcı Oluşturma

### Manuel SQL ile Admin Oluşturma

1. Supabase Dashboard → SQL Editor → "New Query"
2. Aşağıdaki SQL'i çalıştırın:

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
        '',
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

    -- Temel verileri oluştur
    PERFORM create_default_chart_of_accounts(v_user_id);
    PERFORM create_default_tax_rates(v_user_id);
    PERFORM create_default_expense_categories(v_user_id);

    RAISE NOTICE 'Admin kullanıcısı oluşturuldu: %', v_user_id;
END $$;
```

### Script ile Admin Oluşturma

```bash
# Basit script
node scripts/create-admin-simple.js admin@accounting.com Admin123!

# İnteraktif script
node scripts/create-admin.js
```

### Admin Giriş Bilgileri

```
Email: admin@accounting.com
Şifre: Admin123!
Rol: admin
```

### Doğrulama

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

---

## ⭐ Özellikler

### Tamamlanan Özellikler

#### Temel Muhasebe
- ✅ Çift taraflı kayıt sistemi
- ✅ Standart Türk hesap planı (TMS uyumlu)
- ✅ Otomatik yevmiye kaydı
- ✅ Dönem kapama
- ✅ Hesap bakiye takibi

#### Fatura Yönetimi
- ✅ Satış/Alış fatura oluşturma
- ✅ Fatura durumu (Taslak, Gönderildi, Ödendi, İptal)
- ✅ PDF fatura oluşturma ve yazdırma
- ✅ E-posta ile fatura gönderimi
- ✅ Tekrarlayan faturalar (aylık, haftalık, vb.)
- ✅ Çoklu döviz desteği

#### Ödeme ve Tahsilat
- ✅ Kısmi ödeme desteği
- ✅ 5 ödeme yöntemi (Nakit, Havale, Kredi Kartı, Çek, Senet)
- ✅ Otomatik fatura durum güncelleme
- ✅ Ödeme geçmişi

#### Cari Hesap Yönetimi
- ✅ Müşteri/Tedarikçi kayıtları
- ✅ Alacak/Borç takibi
- ✅ Ödeme koşulları
- ✅ İletişim bilgileri yönetimi

#### Gider Yönetimi
- ✅ Gider kaydetme
- ✅ 11 önceden tanımlı kategori
- ✅ Ödeme yöntemi takibi
- ✅ Otomatik yevmiye entegrasyonu

#### Ürün ve Stok
- ✅ Ürün katalog yönetimi
- ✅ Stok takibi
- ✅ Minimum stok uyarıları
- ✅ SKU/Barkod desteği
- ✅ Kategori yönetimi

#### Raporlama
- ✅ Gelir Tablosu
- ✅ Bilanço
- ✅ Mizan (Trial Balance)
- ✅ KDV Beyannamesi
- ✅ Cari Hesap Özeti
- ✅ Yaşlandırma Analizi
- ✅ Excel/PDF export

#### Döviz ve Kurlar
- ✅ TCMB döviz kuru entegrasyonu
- ✅ 4 ana para birimi (TRY, USD, EUR, GBP)
- ✅ Otomatik kur güncelleme
- ✅ Spread hesaplama

#### E-Dönüşüm
- ✅ E-Fatura altyapısı
- ✅ E-Arşiv ayarları
- ✅ Mock provider desteği

#### Güvenlik ve Yetkilendirme
- ✅ Rol tabanlı erişim kontrolü (RBAC)
- ✅ 4 varsayılan rol (Admin, Manager, Accountant, User)
- ✅ Özelleştirilebilir izinler
- ✅ Onay iş akışları

#### Kullanıcı Deneyimi
- ✅ Dark mode
- ✅ Responsive tasarım
- ✅ Toast bildirimleri
- ✅ Loading state'leri
- ✅ Pagination
- ✅ Filtreleme ve arama

### Planlanan Özellikler

#### Kısa Vadeli
- ⏳ Tekrarlayan fatura cron job otomasyonu
- ⏳ E-posta Edge Function deployment
- ⏳ Makbuz yükleme
- ⏳ Onay süreçleri UI

#### Orta Vadeli
- ⏳ Banka entegrasyonu (PSD2)
- ⏳ Gelişmiş stok yönetimi (FIFO/LIFO)
- ⏳ Mobil PWA
- ⏳ Çoklu şirket yönetimi

#### Uzun Vadeli
- ⏳ GİB E-Fatura entegrasyonu
- ⏳ AI destekli OCR
- ⏳ Nakit akışı tahmini
- ⏳ WhatsApp entegrasyonu

---

## 📖 Kullanım Kılavuzu

### Dashboard

Dashboard, işletmenizin finansal durumunun genel özetini görüntüler.

**Özellikler:**
- Gelir/Gider istatistikleri
- Aylık trendler (grafikler)
- Son faturalar
- Toplam alacak/borç durumu
- Müşteri ve fatura sayıları

### Müşteriler

Müşteri ve tedarikçi bilgilerini kaydedin ve yönetin.

**Yeni Müşteri Ekleme:**
1. "Müşteri Ekle" butonuna tıklayın
2. Gerekli bilgileri doldurun:
   - Firma Adı (zorunlu)
   - Tür: Müşteri / Tedarikçi / Her İkisi
   - İletişim: Email, telefon, adres
   - Vergi Bilgileri: TC/Vergi No, Vergi Dairesi
   - Para Birimi: TRY, USD, EUR, GBP
3. "Kaydet" butonuna tıklayın

### Faturalar

Satış faturalarınızı oluşturun, düzenleyin ve takip edin.

**Yeni Fatura Oluşturma:**
1. "Fatura Oluştur" butonuna tıklayın
2. Müşteri seçin
3. Fatura Tarihi ve Vade Tarihi belirleyin
4. Para Birimi seçin
5. Fatura Kalemleri ekleyin:
   - Açıklama, Miktar, Birim Fiyat
   - KDV Oranı, İndirim
6. "Fatura Oluştur" butonuna tıklayın

**Fatura Durumları:**
- 📝 Taslak - Henüz gönderilmemiş
- 📤 Gönderildi - Müşteriye gönderildi
- ✅ Ödendi - Ödeme tamamlandı
- ❌ İptal - İptal edildi

**Fatura İşlemleri:**
- 👁️ Görüntüle - Detayları görün
- 📤 Gönder - E-posta ile gönder
- 📥 PDF İndir - PDF olarak kaydet
- 🖨️ Yazdır - Yazıcıdan çıktı al
- ❌ İptal - Faturayı iptal et

### Tekrarlayan Faturalar

Belirli aralıklarla otomatik fatura oluşturun.

**Yeni Tekrarlayan Fatura:**
1. "Tekrarlayan Fatura Ekle" butonuna tıklayın
2. Müşteri seçin
3. Periyot belirleyin:
   - Günlük, Haftalık, Aylık, 3 Aylık, Yıllık
4. Başlangıç ve Bitiş Tarihi
5. Fatura Kalemleri ekleyin
6. "Oluştur" butonuna tıklayın

**Durum Yönetimi:**
- 🟢 Aktif - Otomatik faturalar oluşuyor
- 🟡 Durduruldu - Geçici olarak durduruldu
- 🔵 Tamamlandı - Bitiş tarihine ulaştı
- 🔴 İptal Edildi - Kalıcı olarak iptal edildi

### Ödemeler

Faturalara yapılan ödemeleri kaydedin.

**Ödeme Kaydetme:**
1. "Ödeme Ekle" butonuna tıklayın
2. Fatura seçin
3. Ödeme Tutarı girin
4. Ödeme Yöntemi seçin
5. Ödeme Tarihi belirleyin
6. Not ekleyin (opsiyonel)
7. "Kaydet" butonuna tıklayın

**Kısmi Ödeme:**
Fatura tutarından daha az ödeme girebilirsiniz. Sistem otomatik olarak kalan bakiyeyi hesaplar.

### Giderler

İşletme giderlerinizi kaydedin.

**Yeni Gider:**
1. "Gider Ekle" butonuna tıklayın
2. Kategori seçin (Kira, Maaş, Elektrik, vb.)
3. Tutar girin
4. Tarih belirleyin
5. Açıklama yazın
6. Ödeme Yöntemi seçin
7. "Kaydet" butonuna tıklayın

### Ürünler

Ürün bilgilerini ve stokları yönetin.

**Yeni Ürün:**
1. "Ürün Ekle" butonuna tıklayın
2. Ürün Adı, Kategori, Açıklama
3. Satış Fiyatı, Alış Fiyatı (opsiyonel)
4. KDV Oranı
5. Stok bilgileri:
   - Mevcut Stok
   - Minimum Stok Seviyesi
   - Birim
6. SKU/Ürün Kodu, Barkod
7. "Kaydet" butonuna tıklayın

**Stok Uyarıları:**
- 🔴 Stokta Yok (Stok = 0)
- 🟡 Düşük Stok (Stok < Minimum)
- 🟢 Normal (Yeterli stok)

### Döviz Kurları

TCMB güncel döviz kurlarını çekin.

**Kurları Güncelleme:**
1. "Kurları Güncelle" butonuna tıklayın
2. Sistem TCMB'den güncel kurları çeker
3. Kurlar otomatik olarak kaydedilir

**Not:** TCMB kurları her iş günü saat 15:30'da güncellenir.

### Raporlar

#### 1. Bilanço (Balance Sheet)
Şirketin finansal durumunu gösteren rapor.

**İçerik:**
- Varlıklar (Aktifler)
- Yükümlülükler (Pasifler)
- Özsermaye
- Finansal oranlar

#### 2. Mizan (Trial Balance)
Hesapların borç-alacak toplamları.

**İçerik:**
- Hesap Kodu ve Adı
- Borç Toplamı
- Alacak Toplamı
- Bakiye

#### 3. Gelir Tablosu
Dönemsel gelir ve gider analizi.

**İçerik:**
- Satış Gelirleri
- Faaliyet Giderleri
- Net Kar/Zarar
- Kar Marjı (%)

#### 4. Cari Hesap Özeti
Müşteri bazlı alacak-borç durumu.

**İçerik:**
- Toplam Fatura
- Ödenen Tutar
- Kalan Bakiye
- Ödeme Oranı (%)

#### 5. KDV Beyannamesi
Dönemsel KDV hesaplamaları.

**İçerik:**
- Hesaplanan KDV (Satış)
- İndirilecek KDV (Alış)
- Ödenecek/Devredilecek KDV

#### 6. Yaşlandırma Analizi
Vadesi geçmiş alacakların analizi.

**Vade Aralıkları:**
- 🟢 0-30 Gün - Normal
- 🟡 31-60 Gün - Dikkat
- 🟠 61-90 Gün - Uyarı
- 🔴 90+ Gün - Risk

### Ayarlar

Kullanıcı profili, şirket bilgileri ve sistem ayarları.

**Ayarlanabilir:**
- Şirket bilgileri ve iletişim
- Varsayılan para birimi ve KDV oranı
- Fatura numarası öneki
- Tema (Light/Dark)

---

## 🌐 TCMB Döviz Kurları Deployment

TCMB döviz kurları özelliği CORS sorunu nedeniyle Supabase Edge Function kullanır.

### Ön Koşullar
1. Supabase projesi oluşturulmuş olmalı
2. Supabase CLI kurulu olmalı

### Deployment Adımları

#### 1. Supabase CLI Kurulumu

```bash
npm install -g supabase
```

#### 2. Supabase Login

```bash
supabase login
```

#### 3. Proje Bağlantısı

```bash
supabase link --project-ref your-project-ref
```

Project ref'i Supabase Dashboard > Project Settings > General > Reference ID'den alabilirsiniz.

#### 4. Edge Function Deploy

```bash
supabase functions deploy fetch-tcmb-rates
```

#### 5. Test

```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-tcmb-rates
```

### Doğrulama

Deployment başarılı olduysa:
- Döviz Kurları sayfasında "Kurları Güncelle" butonuna tıklayın
- TCMB'den güncel kurlar çekilmeli
- Kurlar veritabanına kaydedilmeli

### Önemli Notlar

- TCMB kurları her iş günü saat 15:30'da güncellenir
- Hafta sonları ve resmi tatillerde kur güncellenmez
- Edge function otomatik olarak önceki iş gününün kurunu dener
- Kurlar veritabanında cache'lenir

---

## 🔧 Sorun Giderme

### Auth Hataları

#### "Database error querying schema"

**Sebep:** Supabase Auth, `confirmation_token` gibi alanların NULL olmasını kabul etmiyor.

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

#### "Invalid login credentials"

**Çözüm 1: Şifreyi Sıfırlama**
```sql
UPDATE auth.users
SET encrypted_password = crypt('Admin123!', gen_salt('bf', 10))
WHERE email = 'admin@accounting.com';
```

**Çözüm 2: Kullanıcıyı Kontrol Etme**
```sql
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'admin@accounting.com';
```

#### "Email not confirmed"

**Çözüm:**
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@accounting.com';
```

### Database Hataları

#### "Foreign key constraint violation"

**Çözüm:**
```sql
-- Kullanıcıyı kontrol et
SELECT id FROM auth.users WHERE email = 'admin@accounting.com';
```

Frontend'de null check yapın:
```typescript
if (!user?.id) {
  throw new Error('Kullanıcı bilgisi yüklenemedi')
}
```

#### "Unique constraint violation"

**Çözüm:**
```sql
-- app_settings için
ALTER TABLE app_settings
ADD CONSTRAINT app_settings_user_id_key UNIQUE (user_id);

-- product_categories için
ALTER TABLE product_categories
ADD CONSTRAINT product_categories_user_id_name_key UNIQUE (user_id, name);
```

### RLS Politika Hataları

#### 409 Conflict (roles tablosu)

**Çözüm:**
```sql
DROP POLICY IF EXISTS "Users can manage own roles" ON roles;

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

### Frontend Hataları

#### "User not authenticated" / user.id undefined

**Çözüm:** Null check ekleyin
```typescript
const mutation = useMutation({
  mutationFn: async () => {
    if (!user?.id) {
      throw new Error('Kullanıcı bilgisi yüklenemedi. Lütfen sayfayı yenileyin.')
    }
    // İşlem devam eder
  }
})
```

### Supabase Hataları

#### "Container is not running: exited"

**Çözüm:**
```bash
supabase stop
supabase start
```

#### "Port already in use"

**Çözüm:**
```bash
# Port'u kontrol et
lsof -i :54321

# Process'i öldür
kill -9 <PID>

# Supabase'i yeniden başlat
supabase stop
supabase start
```

#### "Database reset failed"

**Çözüm:**
```bash
# Volumes'ları temizle
docker volume ls --filter label=com.supabase.cli.project=accounting-app
docker volume rm $(docker volume ls -q --filter label=com.supabase.cli.project=accounting-app)

# Yeniden başlat
supabase stop
supabase start
```

### Genel Öneriler

#### 1. Tarayıcıyı Temizle
- Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- Cache temizle
- Private/Incognito mode dene

#### 2. Database'i Kontrol Et
```sql
-- Kullanıcı var mı?
SELECT * FROM auth.users WHERE email = 'admin@accounting.com';

-- Profile var mı?
SELECT * FROM profiles WHERE email = 'admin@accounting.com';

-- Veriler oluşturulmuş mu?
SELECT COUNT(*) FROM chart_of_accounts
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@accounting.com');
```

#### 3. Supabase'i Yeniden Başlat
```bash
supabase stop
supabase start
```

#### 4. Logları İncele
```bash
docker logs supabase_db_accounting-app 2>&1 | tail -50
docker logs supabase_auth_accounting-app 2>&1 | tail -50
docker logs supabase_rest_accounting-app 2>&1 | tail -20
```

---

## 🔌 API ve Servisler

### Supabase Client

**Dosya:** `src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Auth Context

**Dosya:** `src/contexts/AuthContext.tsx`

```typescript
const { user, session, loading, signIn, signUp, signOut } = useAuth()
```

### TanStack Query

**Kullanım:**

```typescript
// Veri çekme
const { data, isLoading, error } = useQuery({
  queryKey: ['invoices'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
    if (error) throw error
    return data
  }
})

// Veri yazma
const mutation = useMutation({
  mutationFn: async (newInvoice) => {
    const { data, error } = await supabase
      .from('invoices')
      .insert([newInvoice])
    if (error) throw error
    return data
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
  }
})
```

### RBAC Service

**Dosya:** `src/services/rbacService.ts`

```typescript
import { RBACService } from '@/services/rbacService'

// İzin kontrolü
const hasPermission = await RBACService.checkPermission(
  userId,
  'invoices',
  'create'
)

// Varsayılan rolleri oluştur
await RBACService.createDefaultRoles(userId)
```

### E-Invoice Service

**Dosya:** `src/services/eInvoiceService.ts`

```typescript
import { EInvoiceService } from '@/services/eInvoiceService'

// E-Fatura XML oluştur
const xml = await EInvoiceService.createEInvoiceXML(invoice)

// E-Fatura gönder
await EInvoiceService.sendEInvoice(invoiceId)
```

### Email Service

**Dosya:** `src/services/email.ts`

```typescript
import { sendEmail } from '@/services/email'

// Fatura e-postası gönder
await sendEmail({
  to: 'customer@example.com',
  subject: 'Faturanız',
  html: emailTemplate,
  attachments: [pdfBuffer]
})
```

### PDF Service

**Dosya:** `src/lib/pdf.ts`

```typescript
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/pdf'

// PDF indir
await downloadInvoicePDF(invoice, company)

// PDF yazdır
await printInvoicePDF(invoice, company)
```

### Excel Export

**Dosya:** `src/lib/excelExport.ts`

```typescript
import { exportToExcel } from '@/lib/excelExport'

// Excel export
exportToExcel(data, 'Faturalar', 'faturalar.xlsx')
```

### Currency Service

**Dosya:** `src/lib/currency.ts`

```typescript
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'

// Para birimi formatla
formatCurrency(1000, 'TRY') // "₺1.000,00"

// Sembol al
getCurrencySymbol('USD') // "$"
```

### Exchange Rate Service

**Dosya:** `src/services/exchangeRate.ts`

```typescript
import { fetchTCMBRates } from '@/services/exchangeRate'

// TCMB kurlarını çek
const rates = await fetchTCMBRates()
```

---

## 📞 Destek

Sorularınız veya sorunlarınız için:
- **Email:** akhantalip@gmail.com
- **GitHub Issues:** [repository-url]/issues
- **Supabase Docs:** https://supabase.com/docs

---

## 📄 Lisans

Bu yazılım MIT Lisansı altında lisanslanmıştır.

---

## 🎉 Katkıda Bulunanlar

- **Talip Akhan** - Geliştirici
- **Claude (Anthropic)** - AI Geliştirme Asistanı

---

**Son Güncelleme:** 2025-01-18
**Versiyon:** 1.3.0
**Durum:** ✅ Aktif Geliştirme
