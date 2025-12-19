# Rollere Göre Menü Dağılımı

Bu dokümanda uygulamadaki rollere göre menü erişim yetkileri açıklanmaktadır.

## Rol Tipleri

- **Admin (admin)**: Tam yetki
- **Müdür (manager)**: Yönetim yetkileri
- **Muhasebeci (accountant)**: Muhasebe işlemleri yetkileri
- **Kullanıcı (user)**: Temel kullanıcı yetkileri

---

## Menü Yapısı ve Erişim Yetkileri

### 1. Genel
**Görünürlük**: Tüm roller

#### Alt Menüler:
- Dashboard → Tüm roller

---

### 2. Satış & Müşteri
**Görünürlük**: Tüm roller

#### Alt Menüler:
- **Müşteriler** → Tüm roller
- **Faturalar** → Tüm roller
- **Tekrarlayan Faturalar** → `accountant`, `manager`, `admin`
- **Ödemeler** → Tüm roller
- **Ürünler & Stok** → Tüm roller

---

### 3. Finans & Nakit
**Görünürlük**: Tüm roller

#### Alt Menüler:
- **Giderler** → Tüm roller
- **Banka Hesapları** → `accountant`, `manager`, `admin`
- **Döviz Kurları** → `accountant`, `manager`, `admin`

---

### 4. Muhasebe
**Görünürlük**: `accountant`, `manager`, `admin`

#### Alt Menüler:
- **Hesap Planı** → `accountant`, `manager`, `admin`
- **Yevmiye Defteri** → `accountant`, `manager`, `admin`
- **Dönem Kapama** → `accountant`, `manager`, `admin`

---

### 5. Raporlar & Analiz
**Görünürlük**: Tüm roller

#### Alt Menüler:
- **Raporlar** → Tüm roller
- **Email Geçmişi** → `manager`, `admin`

---

### 6. E-Dönüşüm
**Görünürlük**: `accountant`, `manager`, `admin`

#### Alt Menüler:
- **E-Fatura Yönetimi** → `accountant`, `manager`, `admin`
- **E-Fatura Ayarları** → `manager`, `admin`
- **E-Arşiv Ayarları** → `manager`, `admin`

---

### 7. Otomasyon
**Görünürlük**: `manager`, `admin`

#### Alt Menüler:
- **Hatırlatmalar** → `manager`, `admin`
- **Onay Akışları** → `manager`, `admin`

---

### 8. Yetki & Ayarlar
**Görünürlük**: Tüm roller

#### Alt Menüler:
- **Kullanıcılar** → `admin`
- **Roller & İzinler** → `admin`
- **Ayarlar** → Tüm roller

---

## Özet Tablo

| Menü Grubu | User | Accountant | Manager | Admin |
|------------|------|------------|---------|-------|
| Genel | ✅ | ✅ | ✅ | ✅ |
| Satış & Müşteri | ✅ (kısmi) | ✅ (kısmi) | ✅ | ✅ |
| Finans & Nakit | ✅ (kısmi) | ✅ | ✅ | ✅ |
| Muhasebe | ❌ | ✅ | ✅ | ✅ |
| Raporlar & Analiz | ✅ (kısmi) | ✅ (kısmi) | ✅ | ✅ |
| E-Dönüşüm | ❌ | ✅ (kısmi) | ✅ | ✅ |
| Otomasyon | ❌ | ❌ | ✅ | ✅ |
| Yetki & Ayarlar | ✅ (kısmi) | ✅ (kısmi) | ✅ (kısmi) | ✅ |

---

## Uygulama Detayları

### Layout.tsx

Menü yapısı `src/components/Layout.tsx` dosyasında `menuGroups` array'i ile tanımlanmıştır.

#### Filtreleme Mantığı:

1. **Grup Seviyesi Filtreleme**:
   - Eğer bir grup için `allowedRoles` tanımlı ise, kullanıcının rolü bu listede olmalıdır
   - Tanımlı değilse tüm roller görebilir

2. **Item Seviyesi Filtreleme**:
   - Her menü item için `allowedRoles` kontrol edilir
   - Tanımlı değilse tüm roller görebilir

3. **Boş Grup Kontrolü**:
   - Tüm itemleri filtrelendikten sonra boş kalan gruplar gösterilmez

### AuthContext.tsx

Kullanıcı rolü `profiles` tablosundan çekilir ve `userRole` olarak context'te saklanır.

#### Profile Loading:
- `profileLoading` state'i ile profile yüklenme durumu takip edilir
- Layout'ta profile yüklenene kadar loading spinner gösterilir
- Bu sayede menüler görünmeden önce kullanıcı rolü hazır olur

---

## Sorun Giderme

### Menüler görünmüyor
1. Kullanıcının `profiles` tablosunda rolünün doğru ayarlanıp ayarlanmadığını kontrol edin
2. Browser console'da hata olup olmadığını kontrol edin
3. `profileLoading` durumunu kontrol edin

### Admin kullanıcısı tüm menüleri göremiyorsa
1. Database'de rolün 'admin' olduğunu doğrulayın:
```sql
SELECT id, email, role FROM profiles WHERE email = 'admin@accounting.com';
```

2. Browser'da sayfayı yenileyin (hard refresh: Cmd+Shift+R)

3. Gerekirse tekrar login olun
