# 📘 Muhasebe Uygulaması - Kullanım Kılavuzu

## 📑 İçindekiler
1. [Dashboard (Ana Sayfa)](#dashboard)
2. [Müşteriler](#müşteriler)
3. [Faturalar](#faturalar)
4. [Tekrarlayan Faturalar](#tekrarlayan-faturalar)
5. [Ödemeler](#ödemeler)
6. [Giderler](#giderler)
7. [Ürün & Stok Yönetimi](#ürün--stok-yönetimi)
8. [Döviz Kurları](#döviz-kurları)
9. [Raporlar](#raporlar)
10. [Ayarlar](#ayarlar)

---

## 🏠 Dashboard

**Ne İşe Yarar:**
İşletmenizin finansal durumunun genel özetini görüntüleyin.

**Özellikler:**
- 📊 Gelir/Gider istatistikleri
- 📈 Aylık trendler (grafikler)
- 📄 Son faturalar
- 💰 Toplam alacak/borç durumu
- 👥 Müşteri ve fatura sayıları

**Nasıl Kullanılır:**
1. Giriş yaptıktan sonra otomatik olarak Dashboard açılır
2. Kartlarda anlık finansal durumunuzu görürsünüz
3. Grafiklerle aylık gelir/gider trendlerini takip edin
4. Son faturalar listesinden hızlıca fatura detaylarına erişin

---

## 👥 Müşteriler

**Ne İşe Yarar:**
Müşteri ve tedarikçi bilgilerini kaydedin ve yönetin.

**Özellikler:**
- 📇 Müşteri/Tedarikçi bilgileri
- 📞 İletişim detayları
- 🏢 Vergi bilgileri (TC/Vergi No, Vergi Dairesi)
- 💰 Ödeme koşulları
- 📥 CSV/Excel dışa aktarma

**Nasıl Kullanılır:**

### Yeni Müşteri Ekleme:
1. **"Müşteri Ekle"** butonuna tıklayın
2. Gerekli bilgileri doldurun:
   - **Firma Adı** (zorunlu)
   - **Tür:** Müşteri / Tedarikçi / Her İkisi
   - **İletişim:** Email, telefon, adres
   - **Vergi Bilgileri:** TC/Vergi No, Vergi Dairesi
   - **Para Birimi:** TRY, USD, EUR, GBP
3. **"Kaydet"** butonuna tıklayın

### Müşteri Düzenleme:
1. Müşteri satırındaki **düzenle** ikonuna tıklayın
2. Bilgileri güncelleyin
3. **"Güncelle"** butonuna tıklayın

### Müşteri Arama:
- Arama kutusuna firma adı yazın
- Tür filtresinden (Müşteri/Tedarikçi) seçim yapın

**💡 İpucu:** Müşteri bilgileri fatura oluştururken otomatik olarak doldurulur.

---

## 📄 Faturalar

**Ne İşe Yarar:**
Satış faturalarınızı oluşturun, düzenleyin, gönderin ve takip edin.

**Özellikler:**
- ✅ Fatura oluşturma (detaylı kalemlerle)
- 📤 Durum yönetimi (Taslak, Gönderildi, Ödendi, İptal)
- 📥 PDF, Excel, CSV dışa aktarma
- 🖨️ Yazdırma
- 🔍 Filtreleme ve arama

> ℹ️ Otomatik email gönderimi için Supabase Edge Function (send-email) deploy edilmeli ve Ayarlar → E-Fatura bölümünde `auto_send` aktif olmalıdır. Aksi halde `Gönder` butonu yalnızca fatura durumunu günceller.

**Nasıl Kullanılır:**

### Yeni Fatura Oluşturma:
1. **"Fatura Oluştur"** butonuna tıklayın
2. **Müşteri** seçin (dropdown'dan)
3. **Fatura Tarihi** ve **Vade Tarihi** belirleyin
4. **Para Birimi** seçin
5. **Fatura Kalemleri** ekleyin:
   - **Açıklama:** Ürün/hizmet adı
   - **Miktar:** Adet
   - **Birim Fiyat:** TL
   - **KDV Oranı:** %18, %10, %8, %1
   - **İndirim:** % olarak
6. **Notlar** ekleyin (opsiyonel)
7. **"Fatura Oluştur"** butonuna tıklayın

### Fatura Durumları:
- 📝 **Taslak:** Henüz gönderilmemiş
- 📤 **Gönderildi:** Müşteriye gönderildi, ödeme bekliyor
- ✅ **Ödendi:** Ödeme tamamlandı
- ❌ **İptal:** İptal edildi

### Fatura İşlemleri:
- **👁️ Görüntüle:** Fatura detaylarını görün
- **📤 Gönder:** Durumu "Gönderildi" olarak işaretler (email otomasyonu için Edge Function + ayarlar gerekir)
- **📥 PDF İndir:** PDF olarak kaydet
- **🖨️ Yazdır:** Doğrudan yazıcıdan çıktı al
- **❌ İptal:** Faturayı iptal et

**💡 İpucu:** Vade tarihi geçmiş faturalar otomatik olarak "Vadesi Geçmiş" olarak işaretlenir.

---

## 🔄 Tekrarlayan Faturalar

**Ne İşe Yarar:**
Belirli aralıklarla otomatik olarak oluşturulan faturalar. Aylık abonelik, kira, hosting gibi düzenli ödemeler için idealdir.

**Özellikler:**
- ⏱️ Periyot seçenekleri (Günlük, Haftalık, Aylık, 3 Aylık, Yıllık)
- 📊 Sonraki fatura tarihini ve üretim sayacını izleme
- ⏸️ Duraklat/Devam ettir ve durum yönetimi
- 🗃️ Fatura kalemleri ve müşteri bilgisi tanımlama

> ⚙️ Arka planda otomatik fatura oluşturma cron job'u henüz devreye alınmadı. Şimdilik kayıtlar takip amaçlı tutulur; manuel tetikleme için planlı cron betiği hazırlanıyor.

**Nasıl Kullanılır:**

### Yeni Tekrarlayan Fatura Oluşturma:
1. **"Tekrarlayan Fatura Ekle"** butonuna tıklayın
2. **Müşteri** seçin
3. **Periyot** belirleyin:
   - **Günlük:** Her gün
   - **Haftalık:** Her hafta
   - **Aylık:** Her ay (en yaygın)
   - **3 Aylık:** 3 ayda bir
   - **Yıllık:** Yılda bir
4. **Başlangıç Tarihi** belirleyin
5. **Bitiş Tarihi** (opsiyonel) - boş bırakırsanız süresiz devam eder
6. **Fatura Kalemleri** ekleyin (normal fatura gibi)
7. **"Oluştur"** butonuna tıklayın

### Örnek Kullanım:
**Senaryo:** ABC Şirketi'ne aylık hosting hizmeti faturalandırması

```
Müşteri: ABC Şirketi
Hizmet: Sunucu Hosting
Tutar: 500 TL/ay
Periyot: Aylık
Başlangıç: 1 Ocak 2025
Bitiş: 31 Aralık 2025 (veya süresiz için boş)
```

→ Cron job aktif edildiğinde sistem her ayın 1'inde otomatik olarak 500 TL'lik fatura oluşturacak şekilde planlanabilir.

### Durum Yönetimi:
- 🟢 **Aktif:** Otomatik faturalar oluşuyor
- 🟡 **Durduruldu:** Geçici olarak durduruldu
- 🔵 **Tamamlandı:** Bitiş tarihine ulaştı
- 🔴 **İptal Edildi:** Kalıcı olarak iptal edildi

### Tekrarlayan Fatura İşlemleri:
- **⏸️ Durdur:** Geçici olarak durdur
- **▶️ Devam Et:** Durdurulmuş faturayı yeniden aktif et
- **🗑️ Sil:** Kalıcı olarak sil

**💡 İpucu:** Cron betiği çalıştırıldığında üretilecek faturalar "Faturalar" sayfasında normal faturalar gibi listelenecek. Şu anda kayıtlar takip ve manuel tetikleme amaçlı.

---

## 💰 Ödemeler

**Ne İşe Yarar:**
Faturalara yapılan ödemeleri kaydedin ve takip edin.

**Özellikler:**
- 💳 Ödeme kaydetme
- 🏦 Ödeme yöntemi seçimi (Nakit, Havale, Kredi Kartı, Çek, Diğer)
- 📊 Kısmi/Tam ödeme takibi
- 💵 Fatura bakiyesi hesaplama

**Nasıl Kullanılır:**

### Ödeme Kaydetme:
1. **"Ödeme Ekle"** butonuna tıklayın
2. **Fatura** seçin (dropdown'dan)
3. **Ödeme Tutarı** girin
4. **Ödeme Yöntemi** seçin:
   - 💵 Nakit
   - 🏦 Banka Havalesi
   - 💳 Kredi Kartı
   - 📝 Çek
   - 🔹 Diğer
5. **Ödeme Tarihi** belirleyin
6. **Not** ekleyin (opsiyonel)
7. **"Kaydet"** butonuna tıklayın

### Kısmi Ödeme:
Fatura tutarından daha az ödeme girebilirsiniz. Sistem otomatik olarak kalan bakiyeyi hesaplar.

**Örnek:**
- Fatura: 1000 TL
- 1. Ödeme: 600 TL → Kalan: 400 TL
- 2. Ödeme: 400 TL → Kalan: 0 TL (Ödendi ✅)

**💡 İpucu:** Tam ödenen faturalar otomatik olarak "Ödendi" durumuna geçer.

---

## 📤 Giderler

**Ne İşe Yarar:**
İşletme giderlerinizi kaydedin, kategorilere ayırın ve takip edin.

**Özellikler:**
- 📝 Gider kaydetme
- 🏷️ Kategori seçimi (otomatik tanımlı listeden)
- 💳 Ödeme yöntemi
- 📥 Excel dışa aktarma
- 🔄 Otomatik yevmiye kaydı (gider eklendiğinde)

> 🗂️ Makbuz yükleme ve gider onay süreçleri planlama aşamasındadır.

**Nasıl Kullanılır:**

### Yeni Gider Ekleme:
1. **"Gider Ekle"** butonuna tıklayın
2. **Kategori** seçin:
   - Kira, Maaş, Elektrik, Su, İnternet
 - Ofis Malzemeleri, Ulaşım, Pazarlama
  - Bakım-Onarım, Danışmanlık, Diğer
3. **Tutar** girin (TL)
4. **Tarih** belirleyin
5. **Açıklama** yazın
6. **Ödeme Yöntemi** seçin
7. **"Kaydet"** butonuna tıklayın

### Gider Kategorileri:
Kategoriler yeni kullanıcı kaydında otomatik eklenir. Şu an için arayüzden kategori oluşturma bulunmuyor; gerekiyorsa Supabase Table Editor üzerinden `expense_categories` tablosuna yeni kayıt ekleyebilirsiniz.

**💡 İpucu:** Gider eklendiği anda raporlara dahil edilir. İlerleyen sürümlerde onay adımları eklenecektir.

---

## 📦 Ürün & Stok Yönetimi

**Ne İşe Yarar:**
Ürün bilgilerini, fiyatları ve stok miktarlarını yönetin.

**Özellikler:**
- 📦 Ürün tanımlama
- 🏷️ Kategori yönetimi
- 🔢 Stok takibi
- 📊 Minimum stok uyarıları
- 🔖 SKU/Barkod tanımlama
- 📥 Excel dışa aktarma

**Nasıl Kullanılır:**

### Yeni Ürün Ekleme:
1. **"Ürün Ekle"** butonuna tıklayın
2. Temel Bilgiler:
   - **Ürün Adı** (zorunlu)
   - **Kategori** (Genel, Hizmet, Yazılım, Donanım, vb.)
   - **Açıklama**
3. Fiyatlandırma:
   - **Satış Fiyatı** (zorunlu)
   - **Alış Fiyatı** (opsiyonel)
   - **KDV Oranı** (%18 varsayılan)
4. Stok Yönetimi:
   - **Mevcut Stok**
   - **Minimum Stok Seviyesi** (uyarı için)
   - **Birim** (adet, kg, m², vb.)
5. Diğer:
   - **SKU/Ürün Kodu**
   - **Barkod**
   - **Hizmet mi?** (Stok takibi gerektirmez)
6. **"Kaydet"** butonuna tıklayın

### Stok Uyarıları:
- 🔴 **Stokta Yok:** Stok = 0
- 🟡 **Düşük Stok:** Stok < Minimum Seviye
- 🟢 **Normal:** Yeterli stok

### Faturada Ürün Kullanımı:
Fatura oluştururken ürünleri seçebilir, otomatik fiyat ve KDV bilgilerini çekebilirsiniz.

**💡 İpucu:** Hizmet ürünleri için "Hizmet" işaretleyerek stok takibini devre dışı bırakın.

---

## 💱 Döviz Kurları

**Ne İşe Yarar:**
TCMB (Merkez Bankası) güncel döviz kurlarını çekin ve kaydedin.

**Özellikler:**
- 🌐 TCMB otomatik kur çekme
- 📊 Ana para birimleri (USD, EUR, GBP) özel görünümü
- 🔍 Arama ve filtreleme
- 📱 Grid/Liste görünümü
- 📊 Spread (Alış-Satış farkı) hesaplama

**Nasıl Kullanılır:**

### Kurları Güncelleme:
1. **"Kurları Güncelle"** butonuna tıklayın
2. Sistem TCMB'den güncel kurları çeker
3. Kurlar otomatik olarak kaydedilir

### Görünüm Değiştirme:
- 📊 **Grid:** Kart görünümü
- 📋 **Liste:** Tablo görünümü

### Kur Bilgileri:
Her para birimi için:
- 💵 **Alış Kuru:** Bankanın döviz alış fiyatı
- 💸 **Satış Kuru:** Bankanın döviz satış fiyatı
- 📊 **Spread:** Alış-satış farkı (%olarak)

**💡 İpucu:** TCMB kurları her iş günü saat 15:30'da güncellenir.

---

## 📊 Raporlar

### 1️⃣ Bilanço (Balance Sheet)

**Ne İşe Yarar:**
Şirketin finansal durumunu gösteren kapsamlı rapor.

**Nasıl Kullanılır:**
1. Raporlar → Bilanço
2. Tarih aralığı seçin
3. Raporu görüntüleyin
4. Excel olarak indirin (PDF desteği planlanıyor)

**İçerik:**
- Varlıklar (Aktifler)
- Yükümlülükler (Pasifler)
- Özsermaye
- Finansal oranlar

---

### 2️⃣ Mizan (Trial Balance)

**Ne İşe Yarar:**
Hesapların borç-alacak toplamlarını gösterir.

**Nasıl Kullanılır:**
1. Raporlar → Mizan
2. Tarih aralığı seçin
3. Hesap koduna göre sıralı listede görüntüleyin

**İçerik:**
- Hesap Kodu ve Adı
- Borç Toplamı
- Alacak Toplamı
- Bakiye

---

### 3️⃣ Gelir Tablosu (Income Statement)

**Ne İşe Yarar:**
Dönemsel gelir ve gider analizi, kar/zarar durumu.

**Nasıl Kullanılır:**
1. Raporlar → Gelir Tablosu
2. Dönem seçin (başlangıç-bitiş tarihi)
3. Raporu inceleyin

**İçerik:**
- **Gelirler:**
  - Satış Gelirleri
  - Diğer Gelirler
- **Giderler:**
  - Faaliyet Giderleri
  - İdari Giderler
  - Diğer Giderler
- **Net Kar/Zarar**
- **Kar Marjı (%)**

**💡 İpucu:** Pozitif net kar = Kâr, Negatif = Zarar

---

### 4️⃣ Cari Hesap Özeti

**Ne İşe Yarar:**
Müşteri bazlı alacak-borç durumunu görüntüleyin.

**Nasıl Kullanılır:**
1. Raporlar → Cari Hesap Özeti
2. Müşteri arayın (opsiyonel)
3. Detayları inceleyin

**İçerik:**
Her müşteri için:
- Toplam Fatura
- Ödenen Tutar
- Kalan Bakiye
- Fatura Sayısı
- Ödeme Oranı (%)

**💡 İpucu:** Risk analizi için ödeme oranına bakın. %50'nin altı riskli olabilir.

---

### 5️⃣ KDV Beyannamesi

**Ne İşe Yarar:**
Dönemsel KDV hesaplamaları.

**Nasıl Kullanılır:**
1. Raporlar → KDV Beyannamesi
2. Dönem seçin (genelde aylık)
3. Hesaplamaları görüntüleyin

**İçerik:**
- **Hesaplanan KDV (Satış):**
  - %18, %10, %8, %1 KDV ayrı ayrı
- **İndirilecek KDV (Alış):**
  - Giderlerden kaynaklanan KDV
- **Ödenecek/Devredilecek KDV:**
  - Pozitif: Hazineye ödenecek
  - Negatif: Sonraki döneme devredilecek

**⚠️ Önemli:** Bu rapor bilgilendirme amaçlıdır. Resmi beyanname için mali müşavirinize danışın.

---

### 6️⃣ Yaşlandırma Analizi (Aging Analysis)

**Ne İşe Yarar:**
Vadesi geçmiş alacakların analizi. Müşterilerin ödeme performansını izleyin.

**Nasıl Kullanılır:**
1. Raporlar → Yaşlandırma Analizi
2. Müşteri bazlı vade aralıklarını görün
3. Risk analizi yapın

**İçerik:**
Her müşteri için vade aralıkları:
- 🟢 **0-30 Gün:** Normal (yeni faturalar)
- 🟡 **31-60 Gün:** Dikkat (takip et)
- 🟠 **61-90 Gün:** Uyarı (hatırlatma gönder)
- 🔴 **90+ Gün:** Risk (acil takip)

**Risk Skorları:**
- 🟢 **Düşük:** 90+ gün oranı %10'un altı
- 🟡 **Orta:** 60+ gün oranı %30 civarı
- 🔴 **Yüksek:** 90+ gün oranı %50'nin üstü

**💡 İpucu:** 90+ gün kolonunda yüksek bakiye olan müşterileri öncelikle takip edin.

---

## ⚙️ Ayarlar

**Ne İşe Yarar:**
Kullanıcı profili, şirket bilgileri ve sistem ayarlarını yapılandırın.

**Özellikler:**
- 👤 Profil bilgileri (salt okunur özet)
- 🏢 Şirket bilgileri ve iletişim alanları
- 💱 Varsayılan para birimi ve KDV oranı
- 🔠 Fatura numarası öneki (ör. `INV`)
- 🎨 Tema ayarları (Light/Dark)

**Nasıl Kullanılır:**
1. Ayarlar sayfasını açın
2. Şirket bilgilerinizi ve varsayılan değerleri güncelleyin
3. Tema için "Karanlık Mod" anahtarını kullanın
4. **"Ayarları Kaydet"** butonuna basın

---

## 🎯 Hızlı Başlangıç Rehberi

### 1️⃣ İlk Kurulum (5 dakika)
1. ✅ Giriş yapın
2. ✅ Ayarlar → Şirket bilgilerini doldurun

### 2️⃣ Müşteri Ekleme (2 dakika)
1. ✅ Müşteriler → Müşteri Ekle
2. ✅ En az 1 müşteri ekleyin

### 3️⃣ Ürün Ekleme (3 dakika)
1. ✅ Ürünler → Ürün Ekle
2. ✅ Sık kullandığınız ürün/hizmetleri ekleyin

### 4️⃣ İlk Fatura (3 dakika)
1. ✅ Faturalar → Fatura Oluştur
2. ✅ Müşteri ve ürünleri seçin
3. ✅ Faturayı oluşturun ve gönderin

### 5️⃣ Ödeme Kaydetme (1 dakika)
1. ✅ Ödemeler → Ödeme Ekle
2. ✅ Faturayı seçin ve ödeme bilgilerini girin

**🎉 Tebrikler! Artık sistemi kullanmaya hazırsınız!**

---

## 💡 Faydalı İpuçları

### 📱 Mobil Kullanım
Uygulama mobil uyumludur (responsive). Tablet ve telefondan rahatlıkla kullanabilirsiniz.

### 🌙 Dark Mode
Ayarlar → Tema → Dark Mode ile gece çalışmalarında gözlerinizi yormazsınız.

### 📥 Toplu İşlemler
Excel'e aktararak toplu veri analizi yapabilirsiniz:
- Faturalar → Excel
- Müşteriler → CSV
- Raporlar → Excel

### 🔒 Güvenlik
- Düzenli olarak şifrenizi değiştirin
- Hassas verileri paylaşmayın
- Tarayıcıdan çıkarken "Çıkış Yap" butonunu kullanın

---

## 🆘 Sık Sorulan Sorular (SSS)

### S: Tekrarlayan faturalar otomatik oluşturulmuyor?
**C:** Arka planda çalışan cron job henüz devreye alınmadı. Kayıtları oluşturduktan sonra faturaları manuel takip edebilir veya planlanan cron scriptini çalıştırarak otomatikleştirebilirsiniz.

### S: KDV oranlarını nasıl değiştirebilirim?
**C:** Ayarlar sayfasındaki "Varsayılan KDV (%)" alanını güncelleyebilirsiniz. Bu değer yeni faturalar ve giderler için varsayılan oran olarak kullanılır.

### S: Fatura numaraları nasıl belirlenir?
**C:** Sistem her yeni fatura için `INV-<timestamp>` formatında benzersiz bir numara üretir. Kendi formatınızı kullanmak isterseniz `src/pages/Invoices.tsx` içindeki numara üretim mantığını güncelleyebilirsiniz.

### S: Döviz kurları güncellenmiyor?
**C:** TCMB API'si sadece iş günlerinde çalışır. Hafta sonu ve tatil günlerinde kur güncellemesi olmaz.

### S: Raporlar boş görünüyor?
**C:** Seçtiğiniz tarih aralığında veri olmayabilir. Tarih aralığını genişletin.

### S: Excel dışa aktarma çalışmıyor?
**C:** Tarayıcınızın pop-up engelleyicisini kontrol edin. İndirmelere izin verdiğinizden emin olun.

---

## 📞 Destek

**Sorun mu yaşıyorsunuz?**
- 📧 Email: akhantalip@gmail.com
- 📖 Dokümantasyon: Bu dosya

---

## 📝 Versiyon Notları

**v1.2.0-dev**
- ✅ PDF fatura ve yazdırma
- ✅ Excel dışa aktarma (faturalar, raporlar, cariler, giderler, ürünler)
- ✅ TCMB döviz kuru entegrasyonu (Edge Function)
- ✅ Tekrarlayan faturalar (cron planlaması bekleniyor)
- ✅ Email altyapısı + Email History ekranı
- ✅ RBAC ve onay akışları
- ✅ Dark mode desteği

---

## 📄 Lisans

Bu yazılım [MIT Lisansı](LICENSE) altında lisanslanmıştır.

---

**🚀 İyi Çalışmalar!**
