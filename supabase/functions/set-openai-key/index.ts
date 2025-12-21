// Set OpenAI API Key Edge Function
// Securely stores and tests OpenAI API key for AI features

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SetKeyRequest {
  api_key: string
  test_connection?: boolean
}

interface SetKeyResponse {
  success: boolean
  message: string
  test_result?: {
    success: boolean
    model?: string
    error?: string
  }
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

    const requestBody: SetKeyRequest = await req.json()

    if (!requestBody.api_key || requestBody.api_key.trim() === '') {
      throw new Error('API key is required')
    }

    const apiKey = requestBody.api_key.trim()

    // Validate API key format (OpenAI keys start with 'sk-')
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format. Key should start with "sk-"')
    }

    // Test connection if requested
    let testResult: SetKeyResponse['test_result'] | undefined

    if (requestBody.test_connection) {
      testResult = await testOpenAIConnection(apiKey)

      if (!testResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'API key test failed',
            test_result: testResult,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Simple encryption using base64 (Note: For production, use proper encryption like Supabase Vault)
    // In a production environment, you should use Supabase Vault or a proper encryption library
    const encryptedKey = btoa(apiKey) // Base64 encoding as basic obfuscation

    // Update app_settings with encrypted key
    const { error: updateError } = await supabaseClient
      .from('app_settings')
      .update({
        encrypted_openai_api_key: encryptedKey,
        openai_api_key_set: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1) // Assuming single settings row with id=1

    if (updateError) {
      throw new Error(`Failed to save API key: ${updateError.message}`)
    }

    const response: SetKeyResponse = {
      success: true,
      message: 'OpenAI API key saved successfully',
      test_result: testResult,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in set-openai-key:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
      }),
      {
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function testOpenAIConnection(
  apiKey: string
): Promise<SetKeyResponse['test_result']> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 5,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.error?.message || `HTTP ${response.status}`,
      }
    }

    const data = await response.json()

    return {
      success: true,
      model: data.model,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}
