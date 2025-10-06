# Supabase Edge Functions

Bu dizin Supabase Edge Functions içerir. Edge Functions, sunucu tarafında çalışan serverless fonksiyonlardır.

## 📧 send-email Function

Email gönderim işlemlerini yönetir.

### Kurulum

#### 1. Resend Hesabı Oluşturun

1. [Resend](https://resend.com) hesabı açın
2. API key alın
3. Domain doğrulayın (opsiyonel ama önerilen)

#### 2. Supabase CLI Kurulumu

```bash
# Supabase CLI'ı yükleyin
npm install -g supabase

# Projeye login olun
supabase login

# Projenizi bağlayın
supabase link --project-ref <your-project-ref>
```

#### 3. API Key'i Secrets'a Ekleyin

```bash
# Resend API key'i ekleyin
supabase secrets set RESEND_API_KEY=re_your_api_key_here

# Secrets'i kontrol edin
supabase secrets list
```

#### 4. Function'ı Deploy Edin

```bash
# Tek function deploy etmek için
supabase functions deploy send-email

# Veya tüm functions'ı deploy etmek için
supabase functions deploy

# Deploy edilen functions'ı listeleyin
supabase functions list
```

### Kullanım

Frontend'den kullanım:

```typescript
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: {
      email: 'customer@example.com',
      name: 'John Doe'
    },
    subject: 'Fatura #INV-001',
    html: '<h1>Faturanız</h1><p>Fatura detayları...</p>',
    text: 'Faturanız - Detaylar...',
    attachments: [{
      filename: 'invoice.pdf',
      content: 'base64-encoded-pdf-content',
      contentType: 'application/pdf'
    }]
  }
})

if (error) {
  console.error('Email error:', error)
} else {
  console.log('Email sent:', data)
}
```

### Test Etme

```bash
# Local test
supabase functions serve send-email

# Başka terminal'de test request gönderin
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"to":{"email":"test@example.com"},"subject":"Test","html":"<p>Test</p>"}'
```

### Alternatif: SendGrid

SendGrid kullanmak isterseniz:

1. [SendGrid](https://sendgrid.com) hesabı açın
2. API key alın
3. Secrets'a ekleyin:
```bash
supabase secrets set SENDGRID_API_KEY=SG_your_api_key
```
4. `send-email/index.ts` dosyasındaki API endpoint'i değiştirin

## 🔄 Diğer Fonksiyonlar (Gelecekte Eklenecek)

- `generate-recurring-invoices` - Tekrarlayan faturaları otomatik oluşturur
- `sync-exchange-rates` - TCMB'den döviz kurlarını çeker
- `process-webhooks` - Banka ve ödeme webhook'larını işler
- `generate-reports` - Ağır raporları arka planda oluşturur

## 📚 Kaynaklar

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Resend API Docs](https://resend.com/docs)
- [SendGrid API Docs](https://docs.sendgrid.com/)
- [Deno Deploy](https://deno.com/deploy)

## 🐛 Sorun Giderme

### Function çalışmıyor

1. Logs'u kontrol edin:
```bash
supabase functions logs send-email
```

2. Secrets'i kontrol edin:
```bash
supabase secrets list
```

3. Authentication'ı kontrol edin (JWT token gönderiliyor mu?)

### Email gönderilemiyor

1. Resend dashboard'unda logs kontrol edin
2. Domain doğrulandı mı? (Production için gerekli)
3. API key doğru mu?
4. Rate limit aşıldı mı?

### Development'ta test

Local development için mock email service kullanabilirsiniz:

```typescript
// src/services/email.ts
const IS_DEV = import.meta.env.DEV

if (IS_DEV) {
  console.log('📧 [DEV] Email would be sent:', params)
  return // Don't actually send in dev
}
```
