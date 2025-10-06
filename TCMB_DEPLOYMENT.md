# TCMB Döviz Kurları - Deployment Kılavuzu

TCMB döviz kurları özelliği CORS sorunu nedeniyle Supabase Edge Function kullanır.

## 📋 Ön Koşullar

1. Supabase projesi oluşturulmuş olmalı
2. Supabase CLI kurulu olmalı

## 🚀 Deployment Adımları

### 1. Supabase CLI Kurulumu

```bash
npm install -g supabase
```

### 2. Supabase Login

```bash
supabase login
```

### 3. Proje Bağlantısı

```bash
supabase link --project-ref your-project-ref
```

Project ref'i Supabase Dashboard > Project Settings > General > Reference ID'den alabilirsiniz.

### 4. Edge Function Deploy

```bash
supabase functions deploy fetch-tcmb-rates
```

### 5. Test

```bash
curl -X POST https://your-project.supabase.co/functions/v1/fetch-tcmb-rates
```

## ✅ Doğrulama

Deployment başarılı olduysa:
- Döviz Kurları sayfasında "Kurları Güncelle" butonuna tıklayın
- TCMB'den güncel kurlar çekilmeli
- Kurlar veritabanına kaydedilmeli

## 🐛 Sorun Giderme

### "Edge function deploy edilmedi mi?" hatası

- Edge function deploy edilmemiş
- `supabase functions deploy fetch-tcmb-rates` komutunu çalıştırın

### 404 hatası

- Project ref yanlış
- Supabase URL environment variable'ı kontrol edin

### CORS hatası hala devam ediyor

- Edge function kullanılmıyor
- `src/services/exchangeRate.ts` dosyasındaki URL'i kontrol edin

## 📝 Notlar

- TCMB kurları her iş günü saat 15:30'da güncellenir
- Hafta sonları ve resmi tatillerde kur güncellenmez
- Edge function otomatik olarak önceki iş gününün kurunu dener
- Kurlar veritabanında cache'lenir, günde bir kez çekilir
