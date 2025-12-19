# 📊 Muhasebe Uygulaması

Modern, kullanıcı dostu muhasebe ve finansal yönetim uygulaması.

## 🚀 Teknolojiler

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Styling:** Tailwind CSS
- **Durum Yönetimi:** TanStack Query
- **Animasyonlar:** Framer Motion
- **Grafikler:** Recharts

## 📁 Proje Yapısı

```
accounting-app/
├── src/
│   ├── components/      # UI bileşenleri
│   ├── pages/          # Sayfa bileşenleri
│   ├── hooks/          # Custom hooks
│   ├── contexts/       # React contexts
│   ├── lib/            # Utilities & configs
│   ├── types/          # TypeScript types
│   ├── services/       # API services
│   └── utils/          # Helper functions
├── docs/               # 📚 Dokümantasyon
│   ├── SETUP_SUMMARY.md      # Yapılanların özeti
│   ├── ADMIN_SETUP.md        # Admin kurulum rehberi
│   ├── SECURITY_UPDATE.md    # Güvenlik güncellemeleri
│   ├── TROUBLESHOOTING.md    # Sorun giderme
│   └── ...                   # Diğer dökümanlar
├── scripts/            # Yardımcı scriptler
│   ├── create-admin.js       # Admin oluşturma (interaktif)
│   ├── create-admin-simple.js # Admin oluşturma (CLI)
│   └── create-admin.sql      # Admin oluşturma (SQL)
├── supabase/
│   ├── migrations/     # Temel veritabanı migration dosyaları
│   └── scripts/        # Ek SQL scriptleri
│       ├── maintenance/ # Bakım ve veri düzeltme scriptleri
│       ├── setup/       # Hızlı kurulum scriptleri
│       └── utilities/   # Yardımcı araç scriptleri
└── public/             # Static files
```

## 🗄️ Veritabanı Yapısı

### Temel Tablolar:
- ✅ **profiles** - Kullanıcı profilleri
- ✅ **companies** - Müşteri/Tedarikçi (Cariler)
- ✅ **accounts** - Hesap planı
- ✅ **invoices** - Faturalar
- ✅ **invoice_items** - Fatura kalemleri
- ✅ **journal_entries** - Muhasebe kayıtları
- ✅ **journal_entry_lines** - Yevmiye detayları
- ✅ **bank_accounts** - Banka hesapları
- ✅ **bank_transactions** - Banka hareketleri
- ✅ **cash_registers** - Kasa
- ✅ **cash_transactions** - Kasa hareketleri
- ✅ **checks** - Çek/Senet
- ✅ **expenses** - Giderler
- ✅ **expense_categories** - Gider kategorileri
- ✅ **tax_rates** - KDV oranları
- ✅ **exchange_rates** - Döviz kurları
- ✅ **app_settings** - Uygulama ayarları

### Özellikler:
- ✅ Row Level Security (RLS) ile güvenlik
- ✅ Otomatik hesaplama trigger'ları
- ✅ Standart hesap planı (TMS)
- ✅ Otomatik yevmiye kaydı
- ✅ Çoklu döviz desteği
- ✅ KDV hesaplamaları

## 🛠️ Kurulum

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Supabase Projesi Oluşturun
1. [Supabase Dashboard](https://app.supabase.com) → Yeni Proje
2. Proje URL ve Anon Key'i kopyalayın

### 3. Environment Variables
`.env` dosyasını düzenleyin:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Database Migration

#### Seçenek A — Supabase CLI (önerilen)
```bash
supabase db push
```

#### Seçenek B — SQL Editor
1. Supabase Dashboard → **SQL Editor**
2. `supabase/scripts/setup/combined_migrations.sql` dosyasının tamamını kopyalayın
3. Tek seferde çalıştırın (tüm tablolar ve fonksiyonlar oluşturulur)

Bu işlemle birlikte ana tablolar ve fonksiyonlar oluşturulur:
- `profiles`, `companies`, `accounts`, `invoice_items`, `journal_entries`
- `payments`, `recurring_invoices`, `products`, `product_categories`
- `e_invoice_settings`, `e_invoices`, `email_history`
- `approval_workflows`, `approval_requests`, `approval_history`
- `exchange_rates`, `tax_rates`, `app_settings` vb.

### 5. Development Server
```bash
npm run dev
```

## 📋 Özellikler

- ✅ Kullanıcı kaydı ve giriş
- ✅ Profil ve şirket ayarları
- ✅ Standart hesap planı (otomatik)
- ✅ Cari hesap yönetimi
- ✅ Fatura oluşturma (satış)
- ✅ Ödeme kaydı (kısmi/tam, nakit/havale/kart/çek)
- ✅ Gider yönetimi
- ✅ Muhasebe kayıtları (yevmiye)
- ✅ Dashboard & Analytics
- ✅ TCMB tabanlı döviz kurları
- ✅ Raporlar (Gelir Tablosu, Bilanço, Mizan, KDV, Cari Özet, Yaşlandırma)
- ✅ Ürün & stok yönetimi
- ✅ E-Fatura ayarları + mock provider üzerinden gönderim
- ✅ Email geçmişi ekranı (Edge Function altyapısı ile)
- ✅ Roller & izinler (RBAC) ve onay akışları
- ✅ Karanlık mod desteği, TL para formatı, Excel/PDF dışa aktarma

### Son Eklenen Özellikler (v1.2.0):
- ✅ **Excel Export** — Faturalar, cariler, giderler, ürünler ve raporlar
- ✅ **Stok Yönetimi** — Ürün/hizmet kartları, stok takibi, min/max stok uyarıları
- ✅ **TCMB Döviz Kurları** — Edge Function üzerinden güncel kur çekme
- ✅ **PDF Fatura** — Türkçe karakter destekli PDF indir/yazdır akışı
- ✅ **Email altyapısı** — Supabase Edge Function + Resend/SendGrid (deployment gerekli)
- ✅ **Ödeme takibi** — Kısmi ödeme ve bakiye yönetimi
- ✅ **Tekrarlayan faturalar** — Periyot bazlı faturalar, manuel tetikleme (cron planlanıyor)
- ✅ **Gelişmiş rapor seti** — Bilanço, Mizan, KDV, Cari Özet, Yaşlandırma

### Geliştirilecek Özellikler:
- ⏳ Canlı E-Fatura entegratörleri (Foriba/Biges/Uyumsoft) ile üretim kullanımı
- ⏳ WhatsApp/SMS bildirimleri
- ⏳ Banka entegrasyonları ve mutabakat
- ⏳ Tekrarlayan faturalar için otomatik cron job
- ⏳ Çok dilli arayüz (i18n) ve ek dil paketleri

## 🔐 Güvenlik

- ✅ Row Level Security (RLS) aktif
- ✅ JWT token tabanlı auth
- ✅ Kullanıcılar sadece kendi verilerini görebilir
- ✅ Admin rolleri için özel yetkiler
- ✅ SQL injection koruması

## 📚 Dokümantasyon

Detaylı dokümantasyon için [`docs/`](./docs) dizinine bakın:

- 📖 [Dokümantasyon İndeksi](./docs/README.md) - Tüm dökümanların katalogu
- 🔧 [Kurulum Özeti](./docs/SETUP_SUMMARY.md) - Yapılan işlemlerin özeti
- 👤 [Admin Kurulumu](./docs/ADMIN_SETUP.md) - Admin kullanıcısı oluşturma
- 🔒 [Güvenlik Güncellemesi](./docs/SECURITY_UPDATE.md) - CVE-2025-55182
- 🔧 [Sorun Giderme](./docs/TROUBLESHOOTING.md) - Yaygın sorunlar ve çözümler
- 📖 [Kullanım Kılavuzu](./docs/KULLANIM_KILAVUZU.md) - Uygulama kullanımı
- 🚀 [Kurulum Rehberi](./docs/SETUP_GUIDE.md) - Detaylı kurulum
- 🎯 [Özellikler](./docs/FEATURES.md) - Tamamlanan ve planlanan özellikler
- 🗺️ [Yol Haritası](./docs/ROADMAP.md) - Proje planı

## 🔐 Giriş Bilgileri

### Admin Kullanıcısı (Local Development)

```
Email: admin@accounting.com
Şifre: Admin123!
Rol: admin
```

**Not:** Production ortamında bu şifreyi mutlaka değiştirin!

## 📚 Kullanım

### İlk Kullanıcı Kaydı:
1. Uygulamayı açın
2. Kayıt olun
3. Sistem otomatik olarak oluşturur:
   - Standart hesap planı
   - KDV oranları (%1, %8, %10, %18, %20)
   - Gider kategorileri
   - Uygulama ayarları

### Fatura Oluşturma:
```typescript
// Fatura oluşturulduğunda otomatik yevmiye kaydı yapılır
// Satış Faturası:
//   - Cari hesaba BORÇ
//   - Satış hesabına ALACAK
//   - KDV hesabına ALACAK
```

> 📄 **PDF Türkçe karakter desteği:** Uygulama jsPDF kullanarak fatura PDF'leri üretir. Türkçe karakterler için Roboto fontu (`public/fonts/Roboto-Regular.ttf`, `Roboto-Bold.ttf`) kullanılır. PDF'ler "PDF İndir" veya "Yazdır" butonları ile oluşturulabilir.

## 🎨 UI/UX

- Modern, minimalist tasarım
- Dark mode desteği
- Responsive (mobile/tablet/desktop)
- Glass morphism efektleri
- Smooth animations (Framer Motion)

## 📞 Destek

Sorularınız için: akhantalip@gmail.com

## 📄 Lisans

MIT License - Ticari kullanım için uygun

---

**Geliştirici:** Talip Akhan
**Versiyon:** 0.0.0 (dev)
**Son Güncelleme:** 2025-01
