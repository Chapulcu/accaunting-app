// AI OCR Processor Edge Function
// Extracts data from invoice/receipt images using GPT-4 Vision

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OCRRequest {
  image_url: string
  source_type: 'invoice' | 'receipt' | 'document' | 'expense'
  source_id?: number
}

interface OCRResult {
  // Invoice/Receipt data
  vendor_name?: string
  vendor_tax_id?: string
  vendor_address?: string
  document_number?: string
  document_date?: string
  due_date?: string
  total_amount?: number
  tax_amount?: number
  subtotal?: number
  currency?: string

  // Line items
  items?: Array<{
    description: string
    quantity?: number
    unit_price?: number
    amount: number
    tax_rate?: number
  }>

  // Additional fields
  payment_method?: string
  category_suggestion?: string
  notes?: string

  // Metadata
  confidence_score: number
  processing_time_ms: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if AI OCR is enabled
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('ai_ocr_enabled, openai_api_key_set')
      .limit(1)
      .single()

    if (!settings?.ai_ocr_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI OCR feature is not enabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!settings?.openai_api_key_set) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key is not configured' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const ocrRequest: OCRRequest = await req.json()

    if (!ocrRequest.image_url || !ocrRequest.source_type) {
      throw new Error('Missing required fields: image_url, source_type')
    }

    const startTime = Date.now()

    // Process image with GPT-4 Vision
    const ocrResult = await processWithGPT4Vision(ocrRequest.image_url)

    const processingTime = Date.now() - startTime
    ocrResult.processing_time_ms = processingTime

    // Save to training data table
    const { data: trainingData, error: saveError } = await supabaseClient
      .from('ai_training_data')
      .insert({
        user_id: user.id,
        source_type: ocrRequest.source_type,
        source_id: ocrRequest.source_id,
        image_url: ocrRequest.image_url,
        extracted_data: ocrResult,
        confidence_score: ocrResult.confidence_score,
        status: 'completed',
        processing_time_ms: processingTime,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving training data:', saveError)
    }

    return new Response(
      JSON.stringify({
        message: 'OCR processing completed',
        result: ocrResult,
        training_data_id: trainingData?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in OCR processor:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function processWithGPT4Vision(imageUrl: string): Promise<OCRResult> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const prompt = `Analyze this invoice/receipt image and extract all relevant information in JSON format.

Extract the following fields:
- vendor_name: Company/vendor name
- vendor_tax_id: Tax ID or VAT number
- vendor_address: Full address
- document_number: Invoice/receipt number
- document_date: Issue date (YYYY-MM-DD format)
- due_date: Payment due date (YYYY-MM-DD format)
- total_amount: Total amount (number)
- tax_amount: Total tax/VAT amount (number)
- subtotal: Subtotal before tax (number)
- currency: Currency code (e.g., TRY, USD, EUR)
- items: Array of line items with description, quantity, unit_price, amount, tax_rate
- payment_method: Payment method if mentioned
- category_suggestion: Suggest an expense category
- notes: Any additional notes or remarks

Also provide a confidence_score (0-100) indicating how confident you are in the extraction.

Return ONLY valid JSON without any markdown formatting or code blocks.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonContent = content.trim()
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '')
    }

    const result = JSON.parse(jsonContent)

    // Ensure confidence_score exists
    if (!result.confidence_score) {
      result.confidence_score = 75 // Default confidence
    }

    return result as OCRResult
  } catch (error) {
    console.error('GPT-4 Vision processing error:', error)
    throw new Error(`Failed to process image with GPT-4 Vision: ${error.message}`)
  }
}
