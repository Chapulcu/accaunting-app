/**
 * E-Fatura Service - Entegratör Soyutlama Katmanı
 *
 * Bu servis farklı e-fatura entegratörlerini (Foriba, Biges, vb.)
 * soyutlar ve ortak bir interface sağlar.
 */

import { supabase } from '@/lib/supabase'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type EInvoiceProvider = 'foriba' | 'biges' | 'uyumsoft' | 'custom'
export type EInvoiceStatus =
  | 'draft'
  | 'created'
  | 'signed'
  | 'sent'
  | 'delivered'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'failed'

export type EInvoiceDirection = 'outgoing' | 'incoming'

export interface EInvoiceSettings {
  id?: string
  user_id: string
  provider: EInvoiceProvider
  environment: 'test' | 'production'
  api_username?: string
  api_password?: string
  api_key?: string
  api_url?: string
  vkn?: string
  company_title?: string
  tax_office?: string
  auto_send: boolean
  auto_create_journal: boolean
  is_active: boolean
}

export interface EInvoiceParty {
  vkn: string // Vergi Kimlik No
  title: string // Ünvan
  taxOffice?: string
  address?: string
  city?: string
  country?: string
  email?: string
  phone?: string
}

export interface EInvoiceLine {
  name: string
  quantity: number
  unit_price: number
  vat_rate: number
  vat_amount: number
  total: number
  unit?: string
  description?: string
}

export interface CreateEInvoiceRequest {
  invoice_id: number // Local invoice ID
  invoice_number: string
  issue_date: string
  seller: EInvoiceParty
  buyer: EInvoiceParty
  lines: EInvoiceLine[]
  subtotal: number
  tax_amount: number
  total_amount: number
  currency?: string
  invoice_type?: string
  notes?: string
}

export interface EInvoiceResponse {
  success: boolean
  e_invoice_uuid?: string
  envelope_uuid?: string
  provider_invoice_id?: string
  status: EInvoiceStatus
  message?: string
  xml_content?: string
  error?: string
}

export interface QueryStatusResponse {
  status: EInvoiceStatus
  delivery_date?: string
  response_date?: string
  response_code?: string
  response_message?: string
  rejection_reason?: string
}

export interface IncomingEInvoice {
  e_invoice_uuid: string
  invoice_number: string
  issue_date: string
  seller: EInvoiceParty
  total_amount: number
  xml_content: string
}

// ============================================================================
// ABSTRACT E-INVOICE PROVIDER
// ============================================================================

export abstract class EInvoiceProvider {
  protected settings: EInvoiceSettings

  constructor(settings: EInvoiceSettings) {
    this.settings = settings
  }

  abstract createInvoice(request: CreateEInvoiceRequest): Promise<EInvoiceResponse>
  abstract queryStatus(e_invoice_uuid: string): Promise<QueryStatusResponse>
  abstract cancelInvoice(
    e_invoice_uuid: string,
    reason: string
  ): Promise<EInvoiceResponse>
  abstract getIncomingInvoices(startDate: Date): Promise<IncomingEInvoice[]>
  abstract downloadXML(e_invoice_uuid: string): Promise<string>
}

// ============================================================================
// MOCK PROVIDER (Development/Testing)
// ============================================================================

export class MockEInvoiceProvider extends EInvoiceProvider {
  async createInvoice(request: CreateEInvoiceRequest): Promise<EInvoiceResponse> {
    // Simüle edilmiş gecikme
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const mockUUID = crypto.randomUUID()

    return {
      success: true,
      e_invoice_uuid: mockUUID,
      envelope_uuid: crypto.randomUUID(),
      provider_invoice_id: `MOCK-${Date.now()}`,
      status: 'sent',
      message: 'Mock e-fatura başarıyla oluşturuldu',
      xml_content: this.generateMockXML(request),
    }
  }

  async queryStatus(e_invoice_uuid: string): Promise<QueryStatusResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500))

    return {
      status: 'delivered',
      delivery_date: new Date().toISOString(),
      response_code: '1000',
      response_message: 'Fatura teslim edildi',
    }
  }

  async cancelInvoice(e_invoice_uuid: string, reason: string): Promise<EInvoiceResponse> {
    await new Promise((resolve) => setTimeout(resolve, 500))

    return {
      success: true,
      status: 'cancelled',
      message: `Fatura iptal edildi: ${reason}`,
    }
  }

  async getIncomingInvoices(startDate: Date): Promise<IncomingEInvoice[]> {
    return [] // Mock'ta gelen fatura yok
  }

  async downloadXML(e_invoice_uuid: string): Promise<string> {
    return '<Invoice>Mock XML Content</Invoice>'
  }

  private generateMockXML(request: CreateEInvoiceRequest): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <UUID>${crypto.randomUUID()}</UUID>
  <InvoiceNumber>${request.invoice_number}</InvoiceNumber>
  <IssueDate>${request.issue_date}</IssueDate>
  <Seller>
    <VKN>${request.seller.vkn}</VKN>
    <Title>${request.seller.title}</Title>
  </Seller>
  <Buyer>
    <VKN>${request.buyer.vkn}</VKN>
    <Title>${request.buyer.title}</Title>
  </Buyer>
  <TotalAmount>${request.total_amount}</TotalAmount>
</Invoice>`
  }
}

// ============================================================================
// FORIBA PROVIDER (Gerçek Entegrasyon)
// ============================================================================

export class ForibaEInvoiceProvider extends EInvoiceProvider {
  private baseURL: string

  constructor(settings: EInvoiceSettings) {
    super(settings)
    this.baseURL = settings.api_url || 'https://api.foriba.com.tr'
  }

  async createInvoice(request: CreateEInvoiceRequest): Promise<EInvoiceResponse> {
    try {
      const response = await fetch(`${this.baseURL}/v1/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.settings.api_key}`,
        },
        body: JSON.stringify({
          invoice_number: request.invoice_number,
          issue_date: request.issue_date,
          seller: request.seller,
          buyer: request.buyer,
          lines: request.lines,
          totals: {
            subtotal: request.subtotal,
            tax: request.tax_amount,
            total: request.total_amount,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          status: 'failed',
          error: data.message || 'E-Fatura oluşturulamadı',
        }
      }

      return {
        success: true,
        e_invoice_uuid: data.uuid,
        envelope_uuid: data.envelope_uuid,
        provider_invoice_id: data.id,
        status: 'sent',
        xml_content: data.xml,
        message: 'E-Fatura başarıyla gönderildi',
      }
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      }
    }
  }

  async queryStatus(e_invoice_uuid: string): Promise<QueryStatusResponse> {
    const response = await fetch(`${this.baseURL}/v1/invoices/${e_invoice_uuid}/status`, {
      headers: {
        Authorization: `Bearer ${this.settings.api_key}`,
      },
    })

    const data = await response.json()

    return {
      status: this.mapStatus(data.status),
      delivery_date: data.delivery_date,
      response_date: data.response_date,
      response_code: data.response_code,
      response_message: data.response_message,
      rejection_reason: data.rejection_reason,
    }
  }

  async cancelInvoice(e_invoice_uuid: string, reason: string): Promise<EInvoiceResponse> {
    const response = await fetch(`${this.baseURL}/v1/invoices/${e_invoice_uuid}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.api_key}`,
      },
      body: JSON.stringify({ reason }),
    })

    const data = await response.json()

    return {
      success: response.ok,
      status: 'cancelled',
      message: data.message,
    }
  }

  async getIncomingInvoices(startDate: Date): Promise<IncomingEInvoice[]> {
    const response = await fetch(
      `${this.baseURL}/v1/invoices/incoming?start_date=${startDate.toISOString()}`,
      {
        headers: {
          Authorization: `Bearer ${this.settings.api_key}`,
        },
      }
    )

    const data = await response.json()
    return data.invoices || []
  }

  async downloadXML(e_invoice_uuid: string): Promise<string> {
    const response = await fetch(`${this.baseURL}/v1/invoices/${e_invoice_uuid}/xml`, {
      headers: {
        Authorization: `Bearer ${this.settings.api_key}`,
      },
    })

    return response.text()
  }

  private mapStatus(providerStatus: string): EInvoiceStatus {
    const statusMap: Record<string, EInvoiceStatus> = {
      DRAFT: 'draft',
      CREATED: 'created',
      SIGNED: 'signed',
      SENT: 'sent',
      DELIVERED: 'delivered',
      ACCEPTED: 'accepted',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      FAILED: 'failed',
    }

    return statusMap[providerStatus] || 'draft'
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createEInvoiceProvider(settings: EInvoiceSettings): EInvoiceProvider {
  switch (settings.provider) {
    case 'foriba':
      return new ForibaEInvoiceProvider(settings)
    case 'biges':
      // return new BigesEInvoiceProvider(settings)
      throw new Error('Biges entegrasyonu henüz hazır değil')
    case 'uyumsoft':
      // return new UyumsoftEInvoiceProvider(settings)
      throw new Error('Uyumsoft entegrasyonu henüz hazır değil')
    case 'custom':
    default:
      return new MockEInvoiceProvider(settings)
  }
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

export const EInvoiceService = {
  /**
   * E-Fatura ayarlarını getir
   */
  async getSettings(userId: string): Promise<EInvoiceSettings | null> {
    const { data, error } = await supabase
      .from('e_invoice_settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  /**
   * E-Fatura ayarlarını kaydet
   */
  async saveSettings(settings: Partial<EInvoiceSettings>): Promise<void> {
    const { error } = await supabase
      .from('e_invoice_settings')
      .upsert(settings, { onConflict: 'user_id' })

    if (error) throw error
  },

  /**
   * Faturadan e-fatura oluştur
   */
  async createFromInvoice(
    userId: string,
    invoiceId: number,
    buyerInfo: EInvoiceParty
  ): Promise<EInvoiceResponse> {
    // 1. Settings ve provider al
    const settings = await this.getSettings(userId)
    if (!settings || !settings.is_active) {
      throw new Error('E-Fatura ayarları yapılmamış')
    }

    const provider = createEInvoiceProvider(settings)

    // 2. Fatura bilgilerini çek
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single()

    if (invoiceError) throw invoiceError

    // 3. E-Fatura request hazırla
    const request: CreateEInvoiceRequest = {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      issue_date: invoice.invoice_date,
      seller: {
        vkn: settings.vkn!,
        title: settings.company_title!,
        taxOffice: settings.tax_office,
      },
      buyer: buyerInfo,
      lines: invoice.invoice_items.map((item: any) => ({
        name: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        vat_rate: item.vat_rate,
        vat_amount: item.vat_amount,
        total: item.total,
      })),
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      currency: invoice.currency,
    }

    // 4. E-Fatura oluştur
    const response = await provider.createInvoice(request)

    // 5. Database'e kaydet
    if (response.success) {
      const { error: saveError } = await supabase.from('e_invoices').insert({
        user_id: userId,
        invoice_id: invoiceId,
        e_invoice_uuid: response.e_invoice_uuid,
        envelope_uuid: response.envelope_uuid,
        invoice_number: request.invoice_number,
        status: response.status,
        direction: 'outgoing',
        issue_date: request.issue_date,
        send_date: new Date().toISOString(),
        subtotal: request.subtotal,
        tax_amount: request.tax_amount,
        total_amount: request.total_amount,
        seller_vkn: request.seller.vkn,
        seller_title: request.seller.title,
        buyer_vkn: request.buyer.vkn,
        buyer_title: request.buyer.title,
        buyer_tax_office: request.buyer.taxOffice,
        xml_content: response.xml_content,
        provider: settings.provider,
        provider_invoice_id: response.provider_invoice_id,
      })

      if (saveError) throw saveError
    }

    return response
  },

  /**
   * E-Fatura durumunu sorgula ve güncelle
   */
  async refreshStatus(eInvoiceUuid: string): Promise<QueryStatusResponse> {
    // E-Fatura kaydını getir
    const { data: eInvoice, error: fetchError } = await supabase
      .from('e_invoices')
      .select('*')
      .eq('e_invoice_uuid', eInvoiceUuid)
      .single()

    if (fetchError) throw fetchError

    // Settings'i user_id'ye göre getir
    const settings = await this.getSettings(eInvoice.user_id)
    if (!settings) throw new Error('E-Fatura ayarları bulunamadı')

    const provider = createEInvoiceProvider(settings)
    const status = await provider.queryStatus(eInvoiceUuid)

    // Durumu güncelle
    await supabase
      .from('e_invoices')
      .update({
        status: status.status,
        delivery_date: status.delivery_date,
        response_date: status.response_date,
        response_code: status.response_code,
        response_message: status.response_message,
        rejection_reason: status.rejection_reason,
      })
      .eq('e_invoice_uuid', eInvoiceUuid)

    // Event kaydet
    await supabase.from('e_invoice_events').insert({
      e_invoice_id: eInvoice.id,
      event_type: status.status,
      message: status.response_message,
      event_data: status,
    })

    return status
  },

  /**
   * Gelen e-faturaları çek ve kaydet
   */
  async fetchIncomingInvoices(userId: string, startDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)): Promise<number> {
    // Settings al
    const settings = await this.getSettings(userId)
    if (!settings || !settings.is_active) {
      throw new Error('E-Fatura ayarları yapılmamış')
    }

    const provider = createEInvoiceProvider(settings)

    // Provider'dan gelen faturaları çek
    const incomingInvoices = await provider.getIncomingInvoices(startDate)

    let savedCount = 0

    for (const incoming of incomingInvoices) {
      // Daha önce kaydedilmiş mi kontrol et
      const { data: existing } = await supabase
        .from('e_invoices')
        .select('id')
        .eq('e_invoice_uuid', incoming.e_invoice_uuid)
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) continue // Zaten kaydedilmiş

      // Yeni gelen fatura kaydet
      const { error } = await supabase.from('e_invoices').insert({
        user_id: userId,
        e_invoice_uuid: incoming.e_invoice_uuid,
        invoice_number: incoming.invoice_number,
        status: 'delivered',
        direction: 'incoming',
        issue_date: incoming.issue_date,
        send_date: incoming.issue_date,
        delivery_date: new Date().toISOString(),
        subtotal: incoming.total_amount * 0.85, // Tahmini (KDV hariç)
        tax_amount: incoming.total_amount * 0.15, // Tahmini KDV
        total_amount: incoming.total_amount,
        seller_vkn: incoming.seller.vkn,
        seller_title: incoming.seller.title,
        buyer_vkn: settings.vkn,
        buyer_title: settings.company_title,
        xml_content: incoming.xml_content,
        provider: settings.provider,
      })

      if (!error) savedCount++
    }

    return savedCount
  },
}
