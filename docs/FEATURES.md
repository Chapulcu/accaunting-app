# 🚀 Özellik Geliştirme Takip Listesi

Bu dosya, muhasebe uygulamasında geliştirilmekte olan özellikleri takip etmek için oluşturulmuştur.

## ✅ Tamamlanan Özellikler

### Temel Özellikler
- [x] Kullanıcı kaydı ve giriş
- [x] Profil yönetimi
- [x] Standart hesap planı (otomatik)
- [x] Cari hesap yönetimi
- [x] Fatura oluşturma (satış/alış)
- [x] Banka/Kasa yönetimi
- [ ] Çek/Senet modülü (çek/senet ekranı planlanıyor)
- [x] Ödeme yönetimi
- [x] Gider yönetimi
- [x] Muhasebe kayıtları (yevmiye)
- [x] Otomatik KDV hesaplama
- [x] Çoklu döviz desteği

### UI/UX Özellikleri
- [x] Dashboard & Analytics
- [x] Raporlar (Gelir Tablosu, Grafik Raporlar)
- [x] Hesap Planı yönetimi
- [x] Şirket ayarları
- [x] Fatura durum yönetimi (Taslak, Gönderildi, Ödendi, İptal)
- [x] Karanlık mod desteği
- [x] TL para birimi formatı
- [x] CSV Export (Fatura, Cari, Gider)
- [x] Sayfalama (Pagination)
- [x] Form Validasyonu

## 🔄 Geliştirme Aşamasında

### 1. ✅ PDF Fatura Oluşturma
**Durum:** 🟢 Tamamlandı
**Öncelik:** Yüksek
**Tamamlanma Tarihi:** 2025-01-XX

**Tamamlanan Alt Görevler:**
- [x] jsPDF ve jspdf-autotable kurulumu
- [x] PDF şablon tasarımı
- [x] Fatura detaylarını PDF'e aktarma
- [x] Türkçe karakter desteği (UTF-8)
- [x] Yazdırma fonksiyonu
- [x] "PDF İndir" ve "Yazdır" butonları ekleme
- [x] Şirket bilgileri entegrasyonu
- [x] Otomatik tablo oluşturma
- [x] Toplam hesaplamalar
- [x] Fatura durum badge'i

**Oluşturulan Dosyalar:**
- `src/lib/pdf.ts` - PDF oluşturma yardımcıları (generateInvoicePDF, downloadInvoicePDF, printInvoicePDF)
- `src/pages/Invoices.tsx` - PDF buton entegrasyonu (Detay modal'ına PDF İndir ve Yazdır butonları eklendi)

---

### 2. ✅ Email Entegrasyonu
**Durum:** 🟢 Altyapı Tamamlandı (Deployment gerekli)
**Öncelik:** Yüksek
**Tamamlanma Tarihi:** 2025-01-XX

**Tamamlanan Alt Görevler:**
- [x] Email servis altyapısı (Resend/SendGrid desteği)
- [x] Supabase Edge Function oluşturma
- [x] Email şablonları oluşturma (Fatura, Ödeme hatırlatma)
- [x] Email geçmişi database migration
- [x] Email History sayfası
- [x] Email gönderme servisi
- [x] Deployment dökümanı

**Deployment Gerekli:**
- Edge function deploy edilmeli: `supabase functions deploy send-email`
- Resend/SendGrid API key secrets'a eklenmeli
- Ayarlar → E-Fatura ekranında `auto_send` seçeneği aktif edilmeli (isteğe bağlı)

**Oluşturulan Dosyalar:**
- `src/services/email.ts` - Email servisi ve şablonlar
- `src/pages/EmailHistory.tsx` - Email geçmişi sayfası
- `supabase/functions/send-email/index.ts` - Edge function
- `supabase/functions/README.md` - Deployment kılavuzu
- `supabase/migrations/012_create_email_history.sql` - Email geçmişi tablosu

---

### 3. ✅ Ödeme Takibi
**Durum:** 🟢 Tamamlandı
**Öncelik:** Yüksek
**Tamamlanma Tarihi:** 2025-01-03

**Tamamlanan Alt Görevler:**
- [x] Ödeme tablosu migration (013_create_payments.sql)
- [x] Kısmi ödeme desteği
- [x] Ödeme geçmişi
- [x] Çoklu ödeme yöntemi (Nakit, Havale, Kredi Kartı, Çek, Senet)
- [x] Fatura ödemelerini takip
- [x] Ödeme istatistikleri
- [x] Ödeme durumu gösterimi

**Oluşturulan Dosyalar:**
- `supabase/migrations/013_create_payments.sql` - Ödeme tablosu ve fonksiyonlar
- `src/pages/Payments.tsx` - Ödeme yönetimi sayfası

---

### 4. ✅ Gelişmiş Raporlar
**Durum:** 🟡 Kısmen Tamamlandı
**Öncelik:** Orta
**Tamamlanma Tarihi:** 2025-01-03

**Tamamlanan Alt Görevler:**
- [x] Bilanço raporu (Balance Sheet)
- [x] Mizan raporu (Trial Balance)
- [x] Raporlar merkezi (Reports Hub)
- [x] PDF export
- [x] Cari hesap özeti
- [x] KDV beyannamesi
- [x] Yaşlandırma analizi
- [x] Excel export

**Oluşturulan Dosyalar:**
- `src/pages/reports/BalanceSheet.tsx` - Bilanço raporu
- `src/pages/reports/TrialBalance.tsx` - Mizan raporu
- `src/pages/ReportsHub.tsx` - Raporlar merkezi

---

### 5. ✅ Tekrarlayan Faturalar
**Durum:** 🟡 Kısmen Tamamlandı
**Öncelik:** Orta
**Tamamlanma Tarihi:** 2025-01-03

**Tamamlanan Alt Görevler:**
- [x] Recurring invoice tablosu migration (014_create_recurring_invoices.sql)
- [x] Recurring invoice items tablosu
- [x] Periyot seçenekleri (günlük/haftalık/aylık/üç aylık/yıllık)
- [x] Frontend UI (oluşturma, listeleme, duraklatma, silme)
- [x] Başlangıç/bitiş tarihi yönetimi
- [x] Durum yönetimi (active, paused, completed, cancelled)
- [x] PostgreSQL fonksiyonları (calculate_next_invoice_date, generate_invoice_from_recurring)
- [ ] Otomatik fatura oluşturma cron job (Planlanan)
- [ ] Email bildirimi (Planlanan)

**Oluşturulan Dosyalar:**
- `supabase/migrations/014_create_recurring_invoices.sql` - Tekrarlayan faturalar tablosu ve fonksiyonlar
- `src/pages/RecurringInvoices.tsx` - Tekrarlayan faturalar yönetim sayfası

---

## ⏳ Planlanan Özellikler (Orta Vadeli)

### 6. 💱 Çoklu Para Birimi İşlemleri
- Gerçek zamanlı döviz kuru API'si (TCMB)
- Para birimi çevirici
- Çoklu para birimi raporları

### 7. 📦 Gelişmiş Stok Yönetimi
- Stok giriş/çıkış fişleri
- Depo bazlı stok takibi
- Maliyetlendirme (FIFO/LIFO)

### 8. 👥 Gelişmiş RBAC ve Denetim
- Modül bazlı izinlerin ekranlara uygulanması
- Aktivite ve onay logları
- Delegasyon/temsilci atama

### 9. 🧾 E-Fatura Entegrasyonu
- GİB entegrasyonu
- E-Fatura gönderimi
- E-Arşiv fatura

### 10. 📱 Mobil Uygulama (PWA)
- Progressive Web App
- Offline çalışma
- Push notifications

---

## 🔮 Uzun Vadeli Özellikler

### 11. 🏦 Banka Entegrasyonu
- Banka hesap senkronizasyonu
- Otomatik mutabakat

### 12. 🤖 AI ve Otomasyon
- Fatura OCR
- Gider kategorisi tahmini
- Nakit akışı tahmini

### 13. 📊 Dashboard Widget'ları
- Özelleştirilebilir dashboard
- Sürükle-bırak widget'lar

### 14. 🌍 Çoklu Dil Desteği
- İngilizce
- Almanca
- i18next tam entegrasyonu

### 15. 🔔 Bildirim Sistemi
- WhatsApp entegrasyonu
- SMS bildirimleri
- In-app bildirimler

---

## 📝 Notlar

### Geliştirme Önceliklendirme Kriterleri
1. **Kullanıcı İhtiyacı:** Kaç kullanıcı bu özelliği talep etti?
2. **İş Etkisi:** Özellik iş süreçlerini ne kadar iyileştirir?
3. **Teknik Karmaşıklık:** Geliştirme süresi ve zorluk?
4. **Bağımlılıklar:** Başka özelliklere mi bağlı?

### Versiyon Hedefleri
- **v1.2.0** – PDF fatura, email altyapısı, ödeme yönetimi (tamamlandı)
- **v1.3.0** – Gelişmiş raporlar, tekrarlayan faturalar, stok modülü (tamamlandı — cron & gelişmiş stok işlevleri beklemede)
- **v1.4.0** – E-Fatura entegratörleri + banka entegrasyonları (planlanıyor)
- **v2.0.0** – Mobil/PWA ve gelişmiş otomasyon (planlanıyor)

---

**Son Güncelleme:** 2025-01-XX
**Geliştirici:** Talip Akhan
