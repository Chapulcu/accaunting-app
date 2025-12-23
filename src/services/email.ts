/**
 * Email Service
 *
 * Bu servis email gönderim işlemlerini yönetir.
 * Supabase Edge Functions kullanarak email gönderimi yapılır.
 *
 * Supabase Edge Function kurulumu için:
 * 1. supabase/functions/send-email/ klasörü oluşturun
 * 2. Resend veya SendGrid API key'i ekleyin
 * 3. Edge function'ı deploy edin
 */

import { supabase } from '@/lib/supabase'
import { getErrorMessage } from '@/utils/error'

export interface EmailTemplate {
  subject: string
  htmlContent: string
  textContent: string
}

export interface EmailRecipient {
  email: string
  name?: string
}

export interface SendEmailParams {
  to: EmailRecipient
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: string // base64 encoded
    contentType: string
  }>
}

/**
 * Email gönderir
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    // Supabase Edge Function çağrısı
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.error || 'Email gönderilemedi')
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Email gönderilemedi')
    console.error('Email send error:', error)
    throw new Error(message)
  }
}

/**
 * Fatura email şablonu oluşturur
 */
export function createInvoiceEmailTemplate(
  invoiceNumber: string,
  companyName: string,
  totalAmount: number,
  dueDate?: string
): EmailTemplate {
  const subject = `Fatura #${invoiceNumber} - ${companyName}`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #4f46e5;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .invoice-details {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .amount {
            font-size: 24px;
            font-weight: bold;
            color: #4f46e5;
            text-align: center;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            background-color: #4f46e5;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Yeni Fatura</h1>
        </div>
        <div class="content">
          <p>Sayın Müşterimiz,</p>
          <p>Aşağıdaki faturanız hazırlanmıştır. Detayları inceleyebilir ve ekte bulunan PDF dosyasını görüntüleyebilirsiniz.</p>

          <div class="invoice-details">
            <div class="detail-row">
              <span><strong>Fatura No:</strong></span>
              <span>${invoiceNumber}</span>
            </div>
            <div class="detail-row">
              <span><strong>Şirket:</strong></span>
              <span>${companyName}</span>
            </div>
            ${dueDate ? `
            <div class="detail-row">
              <span><strong>Vade Tarihi:</strong></span>
              <span>${new Date(dueDate).toLocaleDateString('tr-TR')}</span>
            </div>
            ` : ''}
          </div>

          <div class="amount">
            Toplam Tutar: ₺${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>

          <p style="text-align: center;">
            <a href="#" class="button">Faturayı Görüntüle</a>
          </p>

          <p>Herhangi bir sorunuz olması durumunda bizimle iletişime geçmekten çekinmeyin.</p>

          <p>Teşekkür ederiz.</p>
        </div>

        <div class="footer">
          <p>Bu email otomatik olarak oluşturulmuştur.</p>
          <p>© ${new Date().getFullYear()} ${companyName}. Tüm hakları saklıdır.</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
Sayın Müşterimiz,

Aşağıdaki faturanız hazırlanmıştır:

Fatura No: ${invoiceNumber}
Şirket: ${companyName}
${dueDate ? `Vade Tarihi: ${new Date(dueDate).toLocaleDateString('tr-TR')}` : ''}
Toplam Tutar: ₺${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}

Fatura ekte PDF formatında bulunmaktadır.

Herhangi bir sorunuz olması durumunda bizimle iletişime geçmekten çekinmeyin.

Teşekkür ederiz.

---
Bu email otomatik olarak oluşturulmuştur.
© ${new Date().getFullYear()} ${companyName}
  `

  return {
    subject,
    htmlContent,
    textContent,
  }
}

/**
 * Ödeme hatırlatma email şablonu
 */
export function createPaymentReminderTemplate(
  invoiceNumber: string,
  companyName: string,
  totalAmount: number,
  dueDate: string,
  daysOverdue: number
): EmailTemplate {
  const subject = `Ödeme Hatırlatma - Fatura #${invoiceNumber}`

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #ef4444;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background-color: #fef2f2;
            padding: 30px;
            border: 1px solid #fecaca;
            border-top: none;
          }
          .warning-box {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 20px 0;
          }
          .amount {
            font-size: 24px;
            font-weight: bold;
            color: #ef4444;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Ödeme Hatırlatma</h1>
        </div>
        <div class="content">
          <p>Sayın Müşterimiz,</p>

          <div class="warning-box">
            <p><strong>Fatura #${invoiceNumber}</strong> için ödeme vadesi ${daysOverdue} gün önce dolmuştur.</p>
          </div>

          <p><strong>Vade Tarihi:</strong> ${new Date(dueDate).toLocaleDateString('tr-TR')}</p>

          <div class="amount">
            Ödenecek Tutar: ₺${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </div>

          <p>Ödemenizi en kısa sürede yapmanızı rica ederiz. Eğer ödeme yaptıysanız, lütfen bu mesajı dikkate almayınız.</p>

          <p>İyi günler dileriz.</p>
        </div>
      </body>
    </html>
  `

  const textContent = `
⚠️ Ödeme Hatırlatma - ${companyName}

Sayın Müşterimiz,

Fatura #${invoiceNumber} için ödeme vadesi ${daysOverdue} gün önce dolmuştur.

Vade Tarihi: ${new Date(dueDate).toLocaleDateString('tr-TR')}
Ödenecek Tutar: ₺${totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}

Ödemenizi en kısa sürede yapmanızı rica ederiz. Eğer ödeme yaptıysanız, lütfen bu mesajı dikkate almayınız.

İyi günler dileriz.
  `

  return {
    subject,
    htmlContent,
    textContent,
  }
}

/**
 * Email geçmişi kaydeder
 */
export async function saveEmailHistory(data: {
  invoice_id: number
  recipient_email: string
  subject: string
  status: 'sent' | 'failed'
  error_message?: string
}) {
  try {
    const { error } = await supabase
      .from('email_history')
      .insert([
        {
          ...data,
          sent_at: new Date().toISOString(),
        },
      ])

    if (error) throw error
  } catch (error) {
    console.error('Error saving email history:', error)
    // Don't throw - email history is not critical
  }
}
