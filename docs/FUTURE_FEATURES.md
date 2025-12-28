# 🚀 İleri Özellikler ve Roadmap

**Versiyon:** 1.5.0+
**Son Güncelleme:** 2025-12-28

---

## 📋 İçindekiler

1. [Banka Entegrasyonu (PSD2/Open Banking)](#banka-entegrasyonu)
2. [GİB E-Fatura Entegrasyonu](#gib-e-fatura-entegrasyonu)
3. [Gelişmiş Stok Yönetimi](#gelişmiş-stok-yönetimi)
4. [Mobil PWA](#mobil-pwa)
5. [Gelişmiş AI Modelleri](#gelişmiş-ai-modelleri)
6. [Multi-Currency Advanced Features](#multi-currency-advanced-features)
7. [WhatsApp/SMS Entegrasyonu](#whatsappsms-entegrasyonu)
8. [Advanced Analytics & BI Dashboard](#advanced-analytics--bi-dashboard)

---

## 🏦 Banka Entegrasyonu

### Hedef Versiyon: v1.5.0

### Genel Bakış

PSD2 (Payment Services Directive 2) ve Open Banking standartları kullanılarak Türkiye'deki bankaların API'leri ile entegrasyon.

### Özellikler

#### 1. Hesap Bilgileri Servisi (AIS)
- Banka hesap bakiyesi sorgulama
- İşlem geçmişi çekme (son 90 gün)
- Otomatik mutabakat
- Multi-account support

#### 2. Ödeme Başlatma Servisi (PIS)
- Direkt havale/EFT gönderme
- Toplu ödeme
- İleri tarihli ödeme
- Ödeme durumu takibi

#### 3. Otomatik Mutabakat
- Banka ekstresi ile fatura eşleştirme
- AI destekli eşleştirme algoritması
- Manuel onay mekanizması
- Uyumsuzluk raporlama

### Teknik Altyapı

#### Database Schema

```sql
-- Bank connections table
CREATE TABLE bank_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Bank info
    bank_name TEXT NOT NULL,
    bank_code TEXT NOT NULL, -- BIC/SWIFT code
    connection_type TEXT CHECK (connection_type IN ('ais', 'pis', 'both')),

    -- OAuth credentials (encrypted)
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Account details
    iban TEXT,
    account_number TEXT,
    account_name TEXT,
    currency TEXT DEFAULT 'TRY',

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,

    -- Consent
    consent_id TEXT,
    consent_expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank transactions (imported from bank)
CREATE TABLE bank_imported_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_connection_id UUID REFERENCES bank_connections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Transaction details
    transaction_id TEXT UNIQUE, -- Bank's transaction ID
    transaction_date DATE NOT NULL,
    value_date DATE,

    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'TRY',

    description TEXT,
    counterparty_name TEXT,
    counterparty_iban TEXT,

    -- Transaction type
    type TEXT CHECK (type IN ('credit', 'debit')),
    category TEXT,

    -- Reconciliation
    is_reconciled BOOLEAN DEFAULT false,
    reconciled_with_type TEXT CHECK (reconciled_with_type IN ('invoice', 'payment', 'expense', 'manual')),
    reconciled_with_id INTEGER,
    reconciled_at TIMESTAMPTZ,
    reconciled_by UUID REFERENCES auth.users(id),

    -- AI matching
    suggested_match_type TEXT,
    suggested_match_id INTEGER,
    match_confidence DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank reconciliation rules
CREATE TABLE bank_reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),

    rule_name TEXT NOT NULL,
    rule_type TEXT CHECK (rule_type IN ('description_match', 'amount_match', 'iban_match', 'compound')),

    -- Matching criteria
    description_pattern TEXT, -- Regex pattern
    amount_min DECIMAL(15,2),
    amount_max DECIMAL(15,2),
    counterparty_iban TEXT,

    -- Auto-action
    auto_reconcile BOOLEAN DEFAULT false,
    target_type TEXT CHECK (target_type IN ('invoice', 'expense', 'category')),
    target_category_id INTEGER,

    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Edge Functions

**1. bank-oauth-handler** - OAuth flow for bank connections
**2. bank-sync-transactions** - Fetch and sync bank transactions
**3. bank-reconciliation** - Auto-reconciliation with AI
**4. bank-initiate-payment** - PIS payment initiation

### PSD2 API Providers (Türkiye)

#### Finansbank API
- https://developer.qnbfinansbank.com/
- OAuth 2.0
- AIS & PIS support

#### İşbank API
- https://developer.isbank.com.tr/
- OAuth 2.0
- Comprehensive documentation

#### Yapı Kredi API
- https://apiportal.yapikredi.com.tr/
- OAuth 2.0
- Sandbox environment

#### Aggregator: Multinet OpenAPI
- Tek bir API ile multiple banka
- Simplified integration
- https://api.multinet.com.tr/

### Güvenlik Gereksinimleri

1. **Encryption**:
   - Access tokens AES-256 ile şifrelenecek
   - Supabase Vault kullanımı (secrets)

2. **Consent Management**:
   - 90 günlük consent süresi
   - Manuel yenileme mekanizması
   - Revoke capability

3. **Audit Logging**:
   - Tüm banka işlemleri loglanacak
   - IP adresi ve timestamp
   - User action tracking

### Implementation Steps

1. **Phase 1**: Database schema ve migrations (1 hafta)
2. **Phase 2**: OAuth flow ve token management (2 hafta)
3. **Phase 3**: AIS - Transaction fetching (2 hafta)
4. **Phase 4**: Auto-reconciliation (2 hafta)
5. **Phase 5**: PIS - Payment initiation (2 hafta)
6. **Phase 6**: UI/UX ve testing (1 hafta)

**Toplam Tahmini Süre**: 10 hafta

---

## 📄 GİB E-Fatura Entegrasyonu

### Hedef Versiyon: v1.5.0

### Genel Bakış

Gelir İdaresi Başkanlığı (GİB) ile e-Fatura entegrasyonu.

### Özellikler

#### 1. E-Fatura Gönderimi
- UBL-TR formatında XML oluşturma
- Dijital imzalama (E-İmza)
- GİB'e gönderim
- UUID takibi

#### 2. E-Fatura Alma
- Gelen e-faturaları çekme
- Otomatik fatura oluşturma
- PDF görüntüleme

#### 3. E-Arşiv Fatura
- Bireysel müşteriler için
- PDF oluşturma ve imzalama
- GİB'e bildirim

#### 4. İrsaliye Entegrasyonu
- E-İrsaliye gönderimi
- Teslimat takibi

### Teknik Altyapı

#### GİB Entegratör Seçimi

##### Seçenek 1: Direkt GİB Entegrasyonu
- **Artılar**: Maliyet yok, tam kontrol
- **Eksiler**: Karmaşık, test zorluğu, support yok
- **Gereksinimler**: Mali mühür, e-İmza

##### Seçenek 2: E-Fatura Entegratörü (Önerilen)
- **İnfotek**: https://www.infotek.com.tr/
- **Uyumsoft**: https://www.uyumsoft.com/
- **Logo**: https://www.logo.com.tr/e-donusum
- **Artılar**: Hazır API, support, test ortamı
- **Eksiler**: Aylık maliyet (fatura başına ~0.15-0.30 TL)

#### Database Schema

```sql
-- E-Invoice providers
CREATE TABLE e_invoice_providers (
    id SERIAL PRIMARY KEY,
    provider_name TEXT NOT NULL,
    api_endpoint TEXT,
    test_endpoint TEXT,
    is_active BOOLEAN DEFAULT true,
    pricing_model TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User e-invoice settings (already exists, extend it)
ALTER TABLE e_invoice_settings
ADD COLUMN IF NOT EXISTS gib_alias TEXT, -- GİB alias (firma adı)
ADD COLUMN IF NOT EXISTS gib_registered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mali_muhur_certificate BYTEA, -- Encrypted
ADD COLUMN IF NOT EXISTS mali_muhur_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS provider_id INTEGER REFERENCES e_invoice_providers(id);

-- E-Invoice outbox (giden faturalar)
CREATE TABLE e_invoice_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),

    -- GİB details
    uuid TEXT UNIQUE, -- GİB UUID
    envelope_uuid TEXT,
    gib_status TEXT DEFAULT 'pending' CHECK (gib_status IN ('pending', 'sending', 'sent', 'accepted', 'rejected', 'cancelled')),

    -- XML
    ubl_xml TEXT, -- UBL-TR XML
    signed_xml TEXT, -- Dijital imzalı XML

    -- Timestamps
    sent_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Response codes
    gib_response_code TEXT,
    gib_response_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E-Invoice inbox (gelen faturalar)
CREATE TABLE e_invoice_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),

    -- GİB details
    uuid TEXT UNIQUE,
    envelope_uuid TEXT,
    sender_vkn TEXT,
    sender_name TEXT,
    sender_alias TEXT,

    -- Invoice details (parsed from XML)
    invoice_number TEXT,
    invoice_date DATE,
    total_amount DECIMAL(15,2),
    currency TEXT,

    -- XML
    ubl_xml TEXT,

    -- Processing
    is_processed BOOLEAN DEFAULT false,
    created_invoice_id INTEGER REFERENCES invoices(id),
    processed_at TIMESTAMPTZ,

    -- Status
    status TEXT DEFAULT 'received' CHECK (status IN ('received', 'processed', 'rejected', 'archived')),

    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Edge Functions

**1. gib-create-ubl-xml** - UBL-TR XML oluşturma
**2. gib-sign-xml** - Dijital imzalama
**3. gib-send-invoice** - GİB'e gönderim
**4. gib-fetch-inbox** - Gelen faturaları çekme
**5. gib-cancel-invoice** - Fatura iptali

### UBL-TR XML Şablonu

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
    <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
    <cbc:ID>{{INVOICE_NUMBER}}</cbc:ID>
    <cbc:UUID>{{UUID}}</cbc:UUID>
    <cbc:IssueDate>{{ISSUE_DATE}}</cbc:IssueDate>
    <cbc:IssueTime>{{ISSUE_TIME}}</cbc:IssueTime>
    <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>{{CURRENCY}}</cbc:DocumentCurrencyCode>

    <!-- Supplier (Satıcı) -->
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="VKN">{{SUPPLIER_VKN}}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyName>
                <cbc:Name>{{SUPPLIER_NAME}}</cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName>{{ADDRESS}}</cbc:StreetName>
                <cbc:CityName>{{CITY}}</cbc:CityName>
                <cac:Country>
                    <cbc:Name>Türkiye</cbc:Name>
                </cac:Country>
            </cac:PostalAddress>
        </cac:Party>
    </cac:AccountingSupplierParty>

    <!-- Customer (Alıcı) -->
    <cac:AccountingCustomerParty>
        <!-- Similar structure -->
    </cac:AccountingCustomerParty>

    <!-- Line Items -->
    <cac:InvoiceLine>
        <cbc:ID>1</cbc:ID>
        <cbc:InvoicedQuantity unitCode="{{UNIT}}">{{QUANTITY}}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="{{CURRENCY}}">{{AMOUNT}}</cbc:LineExtensionAmount>
        <cac:Item>
            <cbc:Name>{{DESCRIPTION}}</cbc:Name>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="{{CURRENCY}}">{{UNIT_PRICE}}</cbc:PriceAmount>
        </cac:Price>
        <!-- Tax (KDV) -->
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="{{CURRENCY}}">{{TAX_AMOUNT}}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:Percent>{{TAX_RATE}}</cbc:Percent>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
    </cac:InvoiceLine>

    <!-- Totals -->
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="{{CURRENCY}}">{{SUBTOTAL}}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="{{CURRENCY}}">{{SUBTOTAL}}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="{{CURRENCY}}">{{TOTAL}}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="{{CURRENCY}}">{{TOTAL}}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>
</Invoice>
```

### Dijital İmza

```typescript
// E-İmza kütüphanesi
import * as xmlsec from 'xml-crypto'

function signXML(xml: string, certificate: Buffer, password: string): string {
  // Mali mühür ile imzalama
  const signer = new xmlsec.SignedXml()
  signer.addReference("//*[local-name(.)='Invoice']")
  signer.signingKey = certificate
  signer.computeSignature(xml)
  return signer.getSignedXml()
}
```

### Gereksinimler

1. **Mali Mühür**: E-Fatura göndermek için gerekli
2. **GİB Kayıt**: E-Fatura mükellefi olmak
3. **Entegratör Anlaşması** (eğer 3rd party kullanılacaksa)

### Implementation Steps

1. **Phase 1**: E-Fatura entegratör seçimi ve anlaşma (2 hafta)
2. **Phase 2**: Database schema (1 hafta)
3. **Phase 3**: UBL-TR XML generator (2 hafta)
4. **Phase 4**: Dijital imzalama (1 hafta)
5. **Phase 5**: GİB gönderim/alma (2 hafta)
6. **Phase 6**: UI ve test (2 hafta)

**Toplam Tahmini Süre**: 10 hafta

---

## 📦 Gelişmiş Stok Yönetimi

### Hedef Versiyon: v1.6.0

### Özellikler

- FIFO/LIFO/Weighted Average maliyetlendirme
- Multi-warehouse support
- Stok transfer işlemleri
- Lot/Serial number tracking
- Reorder point automation
- Stok sayım modülü
- Depo haritası ve lokasyon yönetimi

---

## 📱 Mobil PWA

### Hedef Versiyon: v2.0.0

### Özellikler

- Progressive Web App
- Offline-first architecture
- Push notifications
- Camera integration (fatura çekme)
- Responsive mobile UI
- App-like experience

---

## 🤖 Gelişmiş AI Modelleri

### Hedef Versiyon: v2.0.0

### Özellikler

- Fine-tuned OCR models
- Custom GPT models for Turkish accounting
- Anomaly detection
- Fraud detection
- Predictive analytics

---

**Son Güncelleme:** 2025-12-28
**Durum:** Planlama Aşaması
