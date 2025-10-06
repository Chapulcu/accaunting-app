/**
 * Supabase Edge Function - Send Email
 *
 * Bu function email gönderim işlemlerini yönetir.
 * Resend API kullanır (https://resend.com)
 *
 * Kurulum:
 * 1. Resend hesabı oluşturun (https://resend.com)
 * 2. API key alın
 * 3. Supabase secrets'a ekleyin:
 *    supabase secrets set RESEND_API_KEY=re_xxxx
 * 4. Deploy edin:
 *    supabase functions deploy send-email
 *
 * Alternatif olarak SendGrid da kullanılabilir.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EmailRequest {
  to: {
    email: string
    name?: string
  }
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: string // base64 encoded
    contentType: string
  }>
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt)

    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Parse request body
    const emailRequest: EmailRequest = await req.json()

    // Validate required fields
    if (!emailRequest.to?.email || !emailRequest.subject || !emailRequest.html) {
      throw new Error('Missing required fields: to.email, subject, html')
    }

    // Get company settings for "from" email
    const { data: settings } = await supabase
      .from('company_settings')
      .select('company_name, email')
      .eq('user_id', user.id)
      .single()

    const fromEmail = settings?.email || 'noreply@yourdomain.com'
    const fromName = settings?.company_name || 'Muhasebe'

    // Send email using Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [emailRequest.to.email],
        subject: emailRequest.subject,
        html: emailRequest.html,
        text: emailRequest.text,
        attachments: emailRequest.attachments,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      throw new Error(`Resend API error: ${error}`)
    }

    const resendData = await resendResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        emailId: resendData.id,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error sending email:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

/*
 * USAGE EXAMPLE:
 *
 * const { data, error } = await supabase.functions.invoke('send-email', {
 *   body: {
 *     to: {
 *       email: 'customer@example.com',
 *       name: 'John Doe'
 *     },
 *     subject: 'Fatura #INV-001',
 *     html: '<h1>Faturanız</h1><p>...</p>',
 *     text: 'Faturanız...',
 *     attachments: [{
 *       filename: 'invoice.pdf',
 *       content: 'base64-encoded-pdf',
 *       contentType: 'application/pdf'
 *     }]
 *   }
 * })
 *
 * ALTERNATIVE: SendGrid
 *
 * SendGrid kullanmak için:
 * 1. SendGrid API key alın
 * 2. secrets'a ekleyin: supabase secrets set SENDGRID_API_KEY=SG_xxxx
 * 3. Fetch URL'i değiştirin: https://api.sendgrid.com/v3/mail/send
 * 4. Request body'yi SendGrid formatına çevirin
 */
