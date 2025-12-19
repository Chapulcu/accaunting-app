// AI Chatbot Edge Function
// Handles chat conversations with AI assistant

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatRequest {
  message: string
  session_id?: string
  context_entity_type?: string
  context_entity_id?: number
  context_data?: any
}

interface ChatResponse {
  message: string
  session_id: string
  tokens_used?: number
  model_used?: string
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

    // Check if AI chatbot is enabled
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('ai_chatbot_enabled, openai_api_key_set')
      .limit(1)
      .single()

    if (!settings?.ai_chatbot_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI chatbot feature is not enabled' }),
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

    const chatRequest: ChatRequest = await req.json()

    if (!chatRequest.message) {
      throw new Error('Missing required field: message')
    }

    // Generate or use existing session ID
    const sessionId = chatRequest.session_id || crypto.randomUUID()

    // Get chat history for this session
    const { data: history } = await supabaseClient
      .from('ai_chat_history')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(20) // Last 20 messages

    // Build conversation context
    const messages = []

    // System message
    messages.push({
      role: 'system',
      content: `You are a helpful accounting assistant for a Turkish accounting application.
You help users with:
- Understanding their financial data
- Answering questions about invoices, expenses, and payments
- Providing guidance on accounting best practices
- Explaining financial reports and metrics

Be concise, professional, and helpful. Respond in Turkish if the user writes in Turkish.`,
    })

    // Add conversation history
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.message_role,
          content: msg.message_content,
        })
      }
    }

    // Add context if provided
    if (chatRequest.context_data) {
      messages.push({
        role: 'system',
        content: `Context: The user is viewing ${chatRequest.context_entity_type} with ID ${chatRequest.context_entity_id}. Data: ${JSON.stringify(chatRequest.context_data)}`,
      })
    }

    // Add user message
    messages.push({
      role: 'user',
      content: chatRequest.message,
    })

    // Call OpenAI
    const response = await callOpenAI(messages)

    // Save user message to history
    await supabaseClient.from('ai_chat_history').insert({
      user_id: user.id,
      session_id: sessionId,
      message_role: 'user',
      message_content: chatRequest.message,
      context_entity_type: chatRequest.context_entity_type,
      context_entity_id: chatRequest.context_entity_id,
      context_data: chatRequest.context_data,
    })

    // Save assistant response to history
    await supabaseClient.from('ai_chat_history').insert({
      user_id: user.id,
      session_id: sessionId,
      message_role: 'assistant',
      message_content: response.message,
      tokens_used: response.tokens_used,
      model_used: response.model_used,
    })

    return new Response(
      JSON.stringify({
        ...response,
        session_id: sessionId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error in chatbot:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function callOpenAI(messages: any[]): Promise<ChatResponse> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorData}`)
    }

    const data = await response.json()

    return {
      message: data.choices[0].message.content,
      session_id: '', // Will be set by caller
      tokens_used: data.usage?.total_tokens,
      model_used: data.model,
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error(`Failed to get response from AI: ${error.message}`)
  }
}
