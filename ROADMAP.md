# Muhasebe App - Gelişim Yol Haritası

## 📋 Genel Bakış

Bu doküman, uygulamanın gelecek özelliklerini ve entegrasyonlarını aşamalı olarak planlar.

---

## 🎯 Faz 1: E-Belge Entegrasyonları (Öncelik: Yüksek)

### 1.1 E-Fatura Entegrasyonu
**Süre**: 4-6 hafta
**Bağımlılıklar**: GİB E-Fatura API erişimi, entegratör seçimi

#### Özellikler:
- [ ] **GİB E-Fatura API Entegrasyonu**
  - E-Fatura oluşturma ve gönderme
  - Gelen e-faturaları alma ve kaydetme
  - E-Arşiv fatura desteği

- [ ] **Otomatik Fatura Akışı**
  - Manuel faturalardan e-fatura oluşturma
  - Otomatik yevmiye kaydı (mevcut sisteme entegre)
  - Toplu fatura gönderimi

- [ ] **Durum Takibi**
  - Fatura durumu sorgulama (kabul/red)
  - Bildirim sistemi (e-posta/SMS)
  - İptal ve düzeltme işlemleri

#### Teknik Gereksinimler:
```typescript
// Örnek servis yapısı
interface EInvoiceService {
  createInvoice(invoice: Invoice): Promise<EInvoiceResponse>
  queryStatus(uuid: string): Promise<InvoiceStatus>
  cancelInvoice(uuid: string, reason: string): Promise<void>
  getIncomingInvoices(startDate: Date): Promise<IncomingInvoice[]>
}
```

#### Entegrasyon Seçenekleri:
1. **Direkt GİB Entegrasyonu** (Karmaşık, maliyet düşük)
2. **Entegratör Kullanımı** (Kolay, aylık maliyet ~500-2000₺)
   - Foriba, Biges, E-Fatura Turkey vb.

---

### 1.2 E-İrsaliye Entegrasyonu
**Süre**: 3-4 hafta
**Bağımlılıklar**: E-Fatura altyapısı

#### Özellikler:
- [ ] E-İrsaliye oluşturma ve gönderme
- [ ] Stok hareketleriyle entegrasyon
- [ ] Otomatik faturalandırma (irsaliyeden fatura)

---

## 🎯 Faz 2: Banka ve Ödeme Entegrasyonları (Öncelik: Yüksek)

### 2.1 Banka API Entegrasyonları
**Süre**: 6-8 hafta
**Bağımlılıklar**: Banka API erişimi (PSD2/Open Banking)

#### Özellikler:
- [ ] **Hesap Hareketleri Senkronizasyonu**
  - Banka dekontlarını otomatik çekme
  - Hesap bakiyesi güncelleme
  - Ödeme ve tahsilat eşleştirme

- [ ] **Otomatik Mutabakat**
  - Banka hareketleri ↔ Fatura eşleştirme
  - AI destekli kategorizasyon
  - Manuel düzeltme arayüzü

#### Desteklenecek Bankalar:
- Garanti BBVA, İş Bankası, Yapı Kredi (PSD2 API)
- QNB Finansbank, Akbank, Denizbank

#### Teknik Yaklaşım:
```typescript
interface BankIntegration {
  authenticate(credentials: BankCredentials): Promise<BankSession>
  fetchTransactions(accountId: string, dateRange: DateRange): Promise<Transaction[]>
  matchWithInvoices(transactions: Transaction[]): Promise<MatchResult[]>
}
```

---

### 2.2 Ödeme Sistemleri
**Süre**: 2-3 hafta

#### Özellikler:
- [ ] Sanal POS entegrasyonu (İyzico, PayTR)
- [ ] Müşteri self-servis ödeme linkleri
- [ ] Otomatik tahsilat kaydı

---

## 🎯 Faz 3: Yetkilendirme ve İş Akışları (Öncelik: Orta)

### 3.1 Rol Bazlı Erişim Kontrolü (RBAC)
**Süre**: 3-4 hafta

#### Roller:
- [ ] **Yönetici (Admin)**: Tüm yetkiler
- [ ] **Muhasebeci**: Kayıt, rapor, dönem kapama
- [ ] **Kullanıcı**: Fatura ve gider girişi
- [ ] **Misafir**: Sadece raporları görüntüleme

#### Database Yapısı:
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  permissions JSONB NOT NULL
);

CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id),
  role_id UUID REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);
```

---

### 3.2 Onay Mekanizmaları
**Süre**: 4-5 hafta

#### Özellikler:
- [ ] **Yevmiye Onay Sistemi**
  - Draft → Onay Bekliyor → Onaylandı → Deftere Kaydedildi
  - Çoklu onaylayıcı desteği
  - Ret ve yorum ekleme

- [ ] **Gider Onay Akışı**
  - Tutar bazlı onay kuralları
  - Departman yöneticisi onayı
  - Otomatik e-posta bildirimleri

#### Workflow Engine:
```typescript
interface ApprovalWorkflow {
  id: string
  entity_type: 'journal_entry' | 'expense' | 'invoice'
  rules: ApprovalRule[]
  current_step: number
  status: 'pending' | 'approved' | 'rejected'
}

interface ApprovalRule {
  approver_role: string
  condition?: string // "amount > 10000"
  required: boolean
}
```

---

### 3.3 Bildirim Sistemi
**Süre**: 2-3 hafta

#### Kanallar:
- [ ] **E-posta**: Resmi bildirimler, raporlar
- [ ] **Slack/Teams**: Anlık bildirimler
- [ ] **In-App**: Gerçek zamanlı uyarılar
- [ ] **SMS**: Kritik onaylar (opsiyonel)

#### Bildirim Türleri:
- Onay bekleyen kayıtlar
- Dönem kapama hatırlatması
- KDV beyannamesi tarihleri
- Ödeme vadesi yaklaşan faturalar

---

## 🎯 Faz 4: Analitik ve Tahmin Modülleri (Öncelik: Orta-Yüksek)

### 4.1 Nakit Akışı Projeksiyonu
**Süre**: 3-4 hafta

#### Özellikler:
- [ ] **Nakit Akışı Tahmini**
  - 3-6-12 aylık projeksiyonlar
  - Tarihsel veri analizi
  - Sezonsal trendler

- [ ] **Senaryo Analizi**
  - İyimser/Kötümser/Gerçekçi senaryolar
  - "What-if" simülasyonları
  - Kriz planlaması

#### Algoritma:
```python
def predict_cash_flow(historical_data, months_ahead=6):
    # ML Model (Prophet/ARIMA)
    receivables = predict_collections(invoices, payment_patterns)
    payables = predict_payments(expenses, payment_terms)

    return {
        'net_cash_flow': receivables - payables,
        'confidence_interval': (lower_bound, upper_bound),
        'risk_factors': identify_risks()
    }
```

---

### 4.2 Bütçe vs Gerçekleşen
**Süre**: 2-3 hafta

#### Özellikler:
- [ ] Aylık/Yıllık bütçe tanımlama
- [ ] Gerçek zamanlı sapma analizi
- [ ] Görselleştirme (grafikler, heatmap)
- [ ] Otomatik uyarılar (%10+ sapma)

---

### 4.3 Tahsilat Risk Skoru (ML)
**Süre**: 4-6 hafta

#### Özellikler:
- [ ] **Müşteri Risk Profili**
  - Ödeme geçmişi analizi
  - Gecikme oranı hesaplama
  - Risk skoru (0-100)

- [ ] **Tahmin Modeli**
  - Ödeme tahmin tarihi
  - Tahsilat olasılığı
  - Önerilen aksiyonlar

#### ML Pipeline:
```python
features = [
    'avg_payment_delay',      # Ortalama gecikme
    'payment_consistency',    # Düzenlilik
    'invoice_amount',         # Fatura tutarı
    'customer_age',           # Müşteri yaşı
    'seasonal_pattern'        # Sezonsal davranış
]

model = RandomForestClassifier()
risk_score = model.predict_proba(customer_features)
```

---

### 4.4 KDV ve Beyanname Asistanı
**Süre**: 2-3 hafta

#### Özellikler:
- [ ] **Otomatik Hatırlatıcılar**
  - KDV beyanı son tarihleri
  - Geçici vergi dönemleri
  - Stopaj beyanı

- [ ] **Beyan Hazırlığı**
  - Otomatik form doldurma
  - Eksik bilgi uyarıları
  - Gelir İdaresi formatına dönüştürme

---

## 🎯 Faz 5: Mobil ve PWA (Öncelik: Orta)

### 5.1 Progressive Web App (PWA)
**Süre**: 3-4 hafta

#### Özellikler:
- [ ] **Offline Desteği**
  - ServiceWorker cache stratejisi
  - IndexedDB veri saklama
  - Senkronizasyon kuyruğu

- [ ] **Mobil Optimizasyon**
  - Responsive tasarım iyileştirme
  - Touch-friendly arayüzler
  - Hızlı erişim (bottom navigation)

- [ ] **Native Özellikler**
  - Push notifications
  - Kamera (makbuz fotoğrafı)
  - GPS (saha harcamaları)

#### Teknik Kurulum:
```javascript
// service-worker.js
const CACHE_NAME = 'muhasebe-app-v1'
const OFFLINE_URLS = ['/dashboard', '/invoices', '/expenses']

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  )
})
```

---

### 5.2 Mobil Widget'lar
**Süre**: 2-3 hafta

#### iOS Widgetları:
- Günlük gelir/gider özeti
- Bekleyen onaylar sayısı
- Nakit durumu

#### Android Widgetları:
- Hızlı gider girişi
- Fatura durumu
- Ödeme hatırlatıcıları

---

## 🎯 Faz 6: Entegrasyon Ekosistemi (Öncelik: Yüksek)

### 6.1 REST API Geliştirme
**Süre**: 4-5 hafta

#### Endpoint'ler:
```typescript
// API Routes
POST   /api/v1/invoices          // Fatura oluştur
GET    /api/v1/invoices/:id      // Fatura detayı
PUT    /api/v1/invoices/:id      // Fatura güncelle
DELETE /api/v1/invoices/:id      // Fatura sil

POST   /api/v1/journal-entries   // Yevmiye kaydı
GET    /api/v1/reports/balance   // Bilanço raporu
GET    /api/v1/analytics/cash-flow // Nakit akışı

// Webhook Events
POST   /api/v1/webhooks/subscribe
POST   /api/v1/webhooks/unsubscribe
```

#### Authentication:
- API Key (basic)
- OAuth 2.0 (advanced)
- Rate limiting (100 req/min)

---

### 6.2 Zapier/Make Entegrasyonu
**Süre**: 2-3 hafta

#### Tetikleyiciler (Triggers):
- Yeni fatura oluşturuldu
- Ödeme alındı
- Gider eklendi
- Onay bekliyor

#### Aksiyonlar (Actions):
- Fatura oluştur
- Müşteri ekle
- Ödeme kaydet
- Rapor oluştur

---

### 6.3 CRM/ERP Entegrasyonları
**Süre**: 8-12 hafta (platform başına)

#### Desteklenecek Platformlar:
- [ ] **Salesforce**: Müşteri senkronizasyonu
- [ ] **HubSpot**: Lead → Müşteri → Fatura akışı
- [ ] **Microsoft Dynamics**: Full ERP entegrasyonu
- [ ] **SAP Business One**: İleri seviye entegrasyon
- [ ] **Odoo**: Açık kaynak ERP desteği

#### Senkronizasyon Stratejisi:
```typescript
interface SyncStrategy {
  direction: 'unidirectional' | 'bidirectional'
  frequency: 'realtime' | 'hourly' | 'daily'
  conflict_resolution: 'source_wins' | 'target_wins' | 'manual'

  field_mappings: {
    [source_field: string]: string  // target_field
  }
}
```

---

### 6.4 Google Workspace Entegrasyonu
**Süre**: 3-4 hafta

#### Özellikler:
- [ ] **Gmail**
  - Fatura e-postalarını otomatik işleme
  - Ödeme onayı maillerini tanıma

- [ ] **Google Drive**
  - Makbuzları otomatik saklama
  - Raporları otomatik yedekleme

- [ ] **Google Sheets**
  - Canlı veri senkronizasyonu
  - Custom rapor oluşturma

- [ ] **Google Calendar**
  - Ödeme vadeleri hatırlatıcı
  - Dönem kapama tarihleri

---

### 6.5 Slack/Teams Botu
**Süre**: 2-3 hafta

#### Bot Komutları:
```
/muhasebe fatura-olustur [müşteri] [tutar]
/muhasebe gider-ekle [açıklama] [tutar]
/muhasebe bakiye
/muhasebe onay-bekleyen
/muhasebe rapor [tip] [tarih-aralığı]
```

#### Interaktif Özellikler:
- Onay butonları
- Form doldurma (modal)
- Hızlı aksiyonlar

---

## 🎯 Faz 7: Gelişmiş Özellikler (Öncelik: Düşük-Orta)

### 7.1 OCR ve Belge İşleme
**Süre**: 4-6 hafta

#### Özellikler:
- [ ] Makbuz/Fatura OCR
- [ ] Otomatik veri çıkarma
- [ ] Manuel düzeltme arayüzü
- [ ] Toplu işleme

#### Teknoloji:
- Tesseract.js (basic)
- Google Cloud Vision API (advanced)
- Custom ML model (gelecek)

---

### 7.2 Multi-Currency Gelişmiş Destek
**Süre**: 3-4 hafta

#### Özellikler:
- [ ] Otomatik kur güncellemesi
- [ ] Kur farkı hesaplaması
- [ ] Multi-currency raporlar
- [ ] Doviz pozisyonu takibi

---

### 7.3 Çok Şirket Yönetimi
**Süre**: 5-6 hafta

#### Özellikler:
- [ ] Tek hesaptan çok şirket
- [ ] Konsolide raporlar
- [ ] Şirketler arası transfer
- [ ] Grup bazlı yetkilendirme

---

## 📊 Öncelik Matrisi

| Faz | Özellik | İş Değeri | Teknik Zorluk | Öncelik | Süre |
|-----|---------|-----------|---------------|---------|------|
| 1 | E-Fatura | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🔴 Yüksek | 4-6 hafta |
| 2 | Banka API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🔴 Yüksek | 6-8 hafta |
| 3 | RBAC | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🟡 Orta | 3-4 hafta |
| 4 | Analitik | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🟡 Orta-Yüksek | 8-10 hafta |
| 5 | PWA | ⭐⭐⭐ | ⭐⭐⭐ | 🟡 Orta | 3-4 hafta |
| 6 | API/Entegrasyon | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🔴 Yüksek | 8-12 hafta |
| 7 | Gelişmiş | ⭐⭐⭐ | ⭐⭐⭐⭐ | 🟢 Düşük | 12-16 hafta |

---

## 🚀 Önerilen Uygulama Sırası

### Q1 2025 (Ocak-Mart)
1. ✅ **Faz 6.1**: REST API (4 hafta)
2. ✅ **Faz 3.1**: RBAC (3 hafta)
3. ✅ **Faz 3.3**: Bildirim Sistemi (2 hafta)

### Q2 2025 (Nisan-Haziran)
4. ✅ **Faz 1.1**: E-Fatura (6 hafta)
5. ✅ **Faz 6.2**: Zapier (2 hafta)
6. ✅ **Faz 5.1**: PWA (3 hafta)

### Q3 2025 (Temmuz-Eylül)
7. ✅ **Faz 2.1**: Banka API (8 hafta)
8. ✅ **Faz 3.2**: Onay Mekanizmaları (4 hafta)

### Q4 2025 (Ekim-Aralık)
9. ✅ **Faz 4**: Analitik Modüller (10 hafta)
10. ✅ **Faz 6.3**: CRM Entegrasyonları (başlangıç)

---

## 💰 Maliyet Tahmini

### Entegrasyon Maliyetleri (Aylık):
- E-Fatura Entegratör: 500-2000₺
- Banka API: 0₺ (PSD2 ücretsiz)
- Google Cloud Vision: ~$15 (OCR)
- SMS Servisi: 500-1000₺
- Slack/Teams Bot: 0₺ (ücretsiz)

### Geliştirme Maliyetleri:
- Toplam Süre: ~60-80 hafta (1.5 yıl)
- 1 Full-stack Developer: 40.000₺/ay × 18 = 720.000₺
- 1 Backend Developer: 35.000₺/ay × 12 = 420.000₺
- **Toplam**: ~1.140.000₺

### Alternatif: Aşamalı Yaklaşım
- Sadece Faz 1-3: ~20 hafta = 200.000₺
- MVP + Kritik Entegrasyonlar

---

## 📝 Notlar

### Kritik Başarı Faktörleri:
1. **E-Fatura**: Türkiye pazarı için olmazsa olmaz
2. **Banka Entegrasyonu**: Manuel veri girişini %80 azaltır
3. **API Ekosistemi**: Platform değerini 10x artırır
4. **Mobil Deneyim**: Saha çalışanları için kritik

### Riskler ve Önlemler:
- **Risk**: E-Fatura API karmaşıklığı
  - **Önlem**: Entegratör kullan, kademeli geçiş

- **Risk**: Banka API erişim sorunları
  - **Önlem**: Alternatif bankalar, scraping fallback

- **Risk**: Kapsamın genişlemesi
  - **Önlem**: Sıkı önceliklendirme, MVP odaklı

---

## 🔗 Kaynaklar

### API Dokümantasyonları:
- [GİB E-Fatura Entegrasyon](https://ebelge.gib.gov.tr)
- [Türkiye Bankalar Birliği PSD2](https://www.tbb.org.tr/psd2)
- [Zapier Platform](https://platform.zapier.com)
- [Google Cloud Vision](https://cloud.google.com/vision)

### Örnek Entegrasyonlar:
- [Foriba API](https://www.foriba.com.tr/api-dokumantasyonu)
- [İyzico Payment](https://dev.iyzipay.com)
- [Slack API](https://api.slack.com)

---

**Son Güncelleme**: 4 Ekim 2025
**Versiyon**: 1.0
**Hazırlayan**: Development Team
