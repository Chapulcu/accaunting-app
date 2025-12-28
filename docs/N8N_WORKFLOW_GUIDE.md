# n8n Workflow Automation Guide

## 📚 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Kurulum](#kurulum)
3. [Workflow Tipleri](#workflow-tipleri)
4. [Recurring Invoices Automation](#recurring-invoices-automation)
5. [Payment Reminders](#payment-reminders)
6. [Approval Workflows](#approval-workflows)
7. [E-Invoice Automation](#e-invoice-automation)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Genel Bakış

Bu uygulama n8n workflow automation platformu ile entegre çalışır. Aşağıdaki görevleri otomatikleştirilebilir:

- ✅ **Tekrarlayan Faturalar**: Otomatik fatura oluşturma
- ✅ **Ödeme Hatırlatmaları**: Vadesi yaklaşan/geçmiş faturalar için e-posta
- ✅ **Onay Süreçleri**: Fatura ve ödeme onayları
- ✅ **E-Fatura**: Otomatik GİB'e gönderim
- ✅ **Veri Senkronizasyonu**: Dış sistemlerle veri sync

---

## 🚀 Kurulum

### 1. n8n Kurulumu

#### Docker ile (Önerilen):

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=admin123 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

#### npm ile:

```bash
npm install -g n8n
n8n start
```

n8n şimdi `http://localhost:5678` adresinde çalışıyor.

### 2. Uygulama Ayarları

1. Muhasebe uygulamasında **Ayarlar** sayfasına gidin
2. **n8n Otomasyonu** seçeneğini aktif edin
3. Supabase URL ve Anon Key'i n8n'de kullanacaksınız

---

## 📝 Workflow Tipleri

### 1. Recurring (Tekrarlayan)
Zamanlanan görevler için - tekrarlayan faturalar, raporlama

### 2. Reminder (Hatırlatma)
Vadesi yaklaşan/geçmiş faturalar için bildirimler

### 3. Approval (Onay)
İş akışları ve onay süreçleri

### 4. Sync (Senkronizasyon)
Dış sistemlerle veri sync

### 5. E-Invoice (E-Fatura)
GİB entegrasyonu

---

## 🔄 Recurring Invoices Automation

### Senaryo

Aylık olarak müşterilere otomatik fatura oluşturma.

### n8n Workflow Yapısı

```
┌──────────────────┐
│  Schedule Trigger│  (Her gün 09:00)
│  Cron: 0 9 * * * │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  HTTP Request    │  Fetch due recurring invoices
│  GET /functions/ │  v1/recurring-invoices/due
│  v1/...          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Loop Over Items │  For each recurring invoice
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  HTTP Request    │  Generate invoice from recurring
│  POST /rpc/      │  generate_invoice_from_recurring
│  ...             │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Email (optional)│  Send invoice to customer
└──────────────────┘
```

### Adım 1: Schedule Trigger Node

```json
{
  "type": "n8n-nodes-base.cron",
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 9 * * *"
        }
      ]
    }
  },
  "name": "Every Day at 9 AM"
}
```

### Adım 2: Fetch Due Recurring Invoices

**Node Type**: HTTP Request

**Method**: GET

**URL**: `{{$env.SUPABASE_URL}}/rest/v1/rpc/get_due_recurring_invoices`

**Headers**:
```json
{
  "apikey": "{{$env.SUPABASE_ANON_KEY}}",
  "Authorization": "Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}"
}
```

**Function** (Supabase'de oluşturulacak):
```sql
CREATE OR REPLACE FUNCTION get_due_recurring_invoices()
RETURNS TABLE (
    id UUID,
    company_id INTEGER,
    next_invoice_date DATE,
    interval_type TEXT,
    interval_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.company_id,
        r.next_invoice_date,
        r.interval_type,
        r.interval_count
    FROM recurring_invoices r
    WHERE r.status = 'active'
      AND r.next_invoice_date <= CURRENT_DATE
      AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE);
END;
$$;
```

### Adım 3: Loop Over Items Node

**Node Type**: Loop Over Items (SplitInBatches)

Bu node her recurring invoice için ayrı ayrı işlem yapacak.

### Adım 4: Generate Invoice

**Node Type**: HTTP Request

**Method**: POST

**URL**: `{{$env.SUPABASE_URL}}/rest/v1/rpc/generate_invoice_from_recurring`

**Body**:
```json
{
  "p_recurring_invoice_id": "{{$json.id}}"
}
```

**Headers**:
```json
{
  "apikey": "{{$env.SUPABASE_ANON_KEY}}",
  "Authorization": "Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}",
  "Content-Type": "application/json",
  "Prefer": "return=representation"
}
```

### Adım 5: Send Email (Optional)

**Node Type**: HTTP Request

**Method**: POST

**URL**: `{{$env.SUPABASE_URL}}/functions/v1/send-email`

**Body**:
```json
{
  "to": "{{$json.customer_email}}",
  "subject": "Yeni Faturanız",
  "invoice_id": "{{$json.new_invoice_id}}"
}
```

---

## 🔔 Payment Reminders

### Senaryo

Vadesi 3 gün içinde dolacak veya geçmiş faturalar için hatırlatma e-postası.

### n8n Workflow

```
┌──────────────────┐
│  Schedule        │  (Her gün 10:00)
│  Cron: 0 10 * * *│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  HTTP Request    │  Get invoices due soon
│  Supabase RPC    │  or overdue
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Filter          │  Only unpaid invoices
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Loop            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Send Email      │
└──────────────────┘
```

### SQL Function

```sql
CREATE OR REPLACE FUNCTION get_invoices_for_reminder()
RETURNS TABLE (
    invoice_id INTEGER,
    invoice_number TEXT,
    customer_id INTEGER,
    customer_name TEXT,
    customer_email TEXT,
    due_date DATE,
    total_amount DECIMAL,
    remaining_balance DECIMAL,
    days_until_due INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.invoice_number,
        i.company_id,
        c.name,
        c.email,
        i.due_date,
        i.total,
        (i.total - COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = i.id), 0
        )) as remaining_balance,
        (i.due_date - CURRENT_DATE)::INTEGER as days_until_due
    FROM invoices i
    JOIN companies c ON c.id = i.company_id
    WHERE i.status IN ('sent', 'draft')
      AND i.type = 'sale'
      AND (i.total - COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = i.id), 0
        )) > 0
      AND (
          -- Due in 3 days
          i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
          OR
          -- Overdue
          i.due_date < CURRENT_DATE
      )
    ORDER BY i.due_date ASC;
END;
$$;
```

---

## ✅ Approval Workflows

### Senaryo

Belirli tutarın üzerindeki faturalar için onay süreci.

### Webhook Trigger

```json
{
  "event": "invoice.created",
  "condition": "invoice.total > 10000",
  "action": "require_approval"
}
```

### n8n Workflow

1. **Webhook Trigger**: Invoice created event
2. **Condition**: Check if total > threshold
3. **Create Approval Request**: Insert into approval_requests table
4. **Send Email**: Notify approver
5. **Wait for Webhook**: Approval decision
6. **Update Invoice**: Based on approval

---

## 📄 E-Invoice Automation

### Senaryo

Onaylanmış faturaları otomatik olarak GİB'e gönderme.

### Trigger

- Invoice status changed to "approved"
- Webhook event

### Workflow

1. Get invoice details
2. Create E-Invoice XML
3. Sign XML
4. Send to GİB
5. Update invoice with E-Invoice UUID
6. Send confirmation email

---

## 🛠️ Troubleshooting

### n8n'e Bağlanamıyorum

- n8n servisinin çalıştığını kontrol edin: `docker ps` veya `ps aux | grep n8n`
- Port 5678'in açık olduğundan emin olun
- Firewall ayarlarını kontrol edin

### Workflow Çalışmıyor

1. **Logs Kontrol**:
   - n8n UI → Executions → Failed
   - Error mesajlarını inceleyin

2. **Authentication**:
   - Supabase API keys doğru mu?
   - Service role key yerine anon key kullanıyor musunuz?

3. **RLS Policies**:
   - Service role, RLS policies'i bypass eder
   - User-specific queries için doğru user_id kullanın

### Scheduled Tasks Tetiklenmiyor

- Cron expression doğru mu? [crontab.guru](https://crontab.guru) ile test edin
- n8n workflow aktif mi?
- Timezone ayarları doğru mu?

### Email Gönderilmiyor

- send-email Edge Function deploy edildi mi?
- Resend/SendGrid API key ayarlandı mı?
- email_history tablosunda hata var mı?

---

## 📊 Workflow İstatistikleri

n8n_workflow_configs tablosunda her workflow için:

```sql
SELECT
    workflow_name,
    total_executions,
    successful_executions,
    failed_executions,
    ROUND(successful_executions::NUMERIC / NULLIF(total_executions, 0) * 100, 2) as success_rate,
    last_execution_at,
    last_execution_status
FROM n8n_workflow_configs
WHERE is_active = true
ORDER BY total_executions DESC;
```

---

## 🔗 Yararlı Linkler

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community](https://community.n8n.io/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [PostgreSQL Cron](https://github.com/citusdata/pg_cron)

---

**Son Güncelleme**: 2025-12-28
**Versiyon**: 1.0
