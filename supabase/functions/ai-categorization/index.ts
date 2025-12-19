// AI Categorization Edge Function
// Auto-categorizes expenses and invoices using learned rules and AI

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CategorizationRequest {
  entity_type: 'expense' | 'invoice' | 'payment'
  entity_id: number
  description: string
  amount?: number
  vendor_name?: string
  metadata?: any
}

interface CategorizationResult {
  suggested_category_id?: number
  suggested_category_name?: string
  confidence_score: number
  matched_rule_id?: string
  reasoning?: string
  alternative_suggestions?: Array<{
    category_id: number
    category_name: string
    confidence: number
  }>
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

    // Check if AI categorization is enabled
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('ai_categorization_enabled, openai_api_key_set')
      .limit(1)
      .single()

    if (!settings?.ai_categorization_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI categorization feature is not enabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const categorizationRequest: CategorizationRequest = await req.json()

    if (!categorizationRequest.entity_type || !categorizationRequest.description) {
      throw new Error('Missing required fields: entity_type, description')
    }

    // Try rule-based categorization first
    const ruleBasedResult = await applyRuleBasedCategorization(
      supabaseClient,
      user.id,
      categorizationRequest
    )

    if (ruleBasedResult && ruleBasedResult.confidence_score >= 80) {
      // High confidence rule match
      return new Response(
        JSON.stringify({
          message: 'Categorization completed using rules',
          result: ruleBasedResult,
          method: 'rule-based',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Fall back to AI-based categorization
    if (settings?.openai_api_key_set) {
      const aiResult = await aiBasedCategorization(
        supabaseClient,
        user.id,
        categorizationRequest
      )

      return new Response(
        JSON.stringify({
          message: 'Categorization completed using AI',
          result: aiResult,
          method: 'ai-based',
          fallback_rule_result: ruleBasedResult,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Return rule-based result even if confidence is low
    if (ruleBasedResult) {
      return new Response(
        JSON.stringify({
          message: 'Categorization completed using rules (low confidence)',
          result: ruleBasedResult,
          method: 'rule-based',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        message: 'No categorization method available',
        result: null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in categorization:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function applyRuleBasedCategorization(
  supabaseClient: any,
  userId: string,
  request: CategorizationRequest
): Promise<CategorizationResult | null> {
  // Get active categorization rules
  const { data: rules } = await supabaseClient.rpc('get_active_categorization_rules', {
    p_entity_type: request.entity_type,
    p_user_id: userId,
  })

  if (!rules || rules.length === 0) {
    return null
  }

  // Apply rules in priority order
  for (const rule of rules) {
    let matches = false
    let confidence = 0

    switch (rule.rule_type) {
      case 'keyword':
        if (
          rule.pattern &&
          request.description.toLowerCase().includes(rule.pattern.toLowerCase())
        ) {
          matches = true
          confidence = Math.min(90, 60 + (rule.accuracy_rate || 30))
        }
        break

      case 'regex':
        if (rule.pattern) {
          try {
            const regex = new RegExp(rule.pattern, 'i')
            if (regex.test(request.description)) {
              matches = true
              confidence = Math.min(85, 55 + (rule.accuracy_rate || 30))
            }
          } catch (e) {
            console.error('Invalid regex pattern:', rule.pattern)
          }
        }
        break

      case 'amount_range':
        if (
          request.amount &&
          rule.amount_min !== null &&
          rule.amount_max !== null &&
          request.amount >= rule.amount_min &&
          request.amount <= rule.amount_max
        ) {
          matches = true
          confidence = Math.min(75, 45 + (rule.accuracy_rate || 30))
        }
        break

      case 'ai_learned':
        // AI-learned rules have higher confidence based on accuracy_rate
        if (
          rule.pattern &&
          request.description.toLowerCase().includes(rule.pattern.toLowerCase())
        ) {
          matches = true
          confidence = Math.min(95, rule.accuracy_rate || 70)
        }
        break
    }

    if (matches) {
      return {
        suggested_category_id: rule.target_category_id,
        suggested_category_name: rule.target_category_name,
        confidence_score: confidence,
        matched_rule_id: rule.id,
        reasoning: `Matched ${rule.rule_type} rule with ${rule.accuracy_rate?.toFixed(1) || 'unknown'}% historical accuracy`,
      }
    }
  }

  return null
}

async function aiBasedCategorization(
  supabaseClient: any,
  userId: string,
  request: CategorizationRequest
): Promise<CategorizationResult> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Get available categories (you might want to fetch from database)
  // For now, using common categories
  const commonCategories = [
    'Office Supplies',
    'Travel',
    'Meals & Entertainment',
    'Utilities',
    'Rent',
    'Software & Subscriptions',
    'Marketing & Advertising',
    'Professional Services',
    'Insurance',
    'Equipment',
    'Salaries & Wages',
    'Taxes',
    'Other',
  ]

  const prompt = `Categorize the following transaction:

Description: ${request.description}
${request.amount ? `Amount: ${request.amount}` : ''}
${request.vendor_name ? `Vendor: ${request.vendor_name}` : ''}
Type: ${request.entity_type}

Available categories: ${commonCategories.join(', ')}

Provide:
1. The most appropriate category
2. Confidence score (0-100)
3. Brief reasoning
4. Up to 2 alternative suggestions with confidence scores

Return ONLY valid JSON in this format:
{
  "suggested_category_name": "category name",
  "confidence_score": 85,
  "reasoning": "brief explanation",
  "alternative_suggestions": [
    {"category_name": "alternative 1", "confidence": 70},
    {"category_name": "alternative 2", "confidence": 60}
  ]
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert accountant helping categorize business transactions accurately.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON from response
    let jsonContent = content.trim()
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '')
    }

    const result = JSON.parse(jsonContent)

    return result as CategorizationResult
  } catch (error) {
    console.error('AI categorization error:', error)
    throw new Error(`Failed to categorize with AI: ${error.message}`)
  }
}
