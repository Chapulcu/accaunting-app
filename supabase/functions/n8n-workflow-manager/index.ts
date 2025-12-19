// N8N Workflow Manager Edge Function
// Manages n8n workflow configurations (CRUD operations)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkflowConfig {
  n8n_workflow_id?: string
  workflow_name: string
  workflow_type: 'approval' | 'reminder' | 'recurring' | 'sync' | 'e-invoice'
  trigger_type: 'webhook' | 'schedule' | 'manual'
  webhook_url?: string
  schedule_cron?: string
  trigger_config?: any
  is_active?: boolean
  description?: string
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

    // Check if n8n is enabled
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('n8n_enabled')
      .limit(1)
      .single()

    if (!settings?.n8n_enabled) {
      return new Response(
        JSON.stringify({ error: 'n8n feature is not enabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const action = pathParts[pathParts.length - 1] // Last part of path

    // Route to appropriate handler
    switch (req.method) {
      case 'GET':
        if (action === 'list' || action === 'n8n-workflow-manager') {
          return await listWorkflows(supabaseClient, user.id, url.searchParams)
        } else {
          // Get specific workflow by ID
          const workflowId = action
          return await getWorkflow(supabaseClient, user.id, workflowId)
        }

      case 'POST':
        if (action === 'create') {
          const workflow = await req.json()
          return await createWorkflow(supabaseClient, user.id, workflow)
        } else if (action === 'toggle') {
          const { workflow_id, is_active } = await req.json()
          return await toggleWorkflow(supabaseClient, user.id, workflow_id, is_active)
        }
        break

      case 'PUT':
      case 'PATCH':
        const { workflow_id, ...updates } = await req.json()
        return await updateWorkflow(supabaseClient, user.id, workflow_id, updates)

      case 'DELETE':
        const body = await req.json()
        return await deleteWorkflow(supabaseClient, user.id, body.workflow_id)

      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in workflow manager:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function listWorkflows(supabaseClient: any, userId: string, params: URLSearchParams) {
  const workflowType = params.get('workflow_type')
  const isActive = params.get('is_active')

  let query = supabaseClient
    .from('n8n_workflow_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (workflowType) {
    query = query.eq('workflow_type', workflowType)
  }

  if (isActive !== null) {
    query = query.eq('is_active', isActive === 'true')
  }

  const { data, error } = await query

  if (error) throw error

  return new Response(JSON.stringify({ workflows: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function getWorkflow(supabaseClient: any, userId: string, workflowId: string) {
  const { data, error } = await supabaseClient
    .from('n8n_workflow_configs')
    .select('*')
    .eq('id', workflowId)
    .eq('user_id', userId)
    .single()

  if (error) throw error

  if (!data) {
    return new Response(JSON.stringify({ error: 'Workflow not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ workflow: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createWorkflow(supabaseClient: any, userId: string, workflow: WorkflowConfig) {
  // Validate workflow configuration
  if (!workflow.workflow_name || !workflow.workflow_type || !workflow.trigger_type) {
    throw new Error('Missing required fields: workflow_name, workflow_type, trigger_type')
  }

  if (workflow.trigger_type === 'webhook' && !workflow.webhook_url) {
    throw new Error('webhook_url is required for webhook trigger type')
  }

  if (workflow.trigger_type === 'schedule' && !workflow.schedule_cron) {
    throw new Error('schedule_cron is required for schedule trigger type')
  }

  const { data, error } = await supabaseClient
    .from('n8n_workflow_configs')
    .insert({
      ...workflow,
      user_id: userId,
      is_active: workflow.is_active ?? true,
      trigger_config: workflow.trigger_config ?? {},
    })
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({
      message: 'Workflow created successfully',
      workflow: data,
    }),
    {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function updateWorkflow(
  supabaseClient: any,
  userId: string,
  workflowId: string,
  updates: Partial<WorkflowConfig>
) {
  const { data, error } = await supabaseClient
    .from('n8n_workflow_configs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workflowId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({
      message: 'Workflow updated successfully',
      workflow: data,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function toggleWorkflow(
  supabaseClient: any,
  userId: string,
  workflowId: string,
  isActive: boolean
) {
  const { data, error } = await supabaseClient
    .from('n8n_workflow_configs')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workflowId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return new Response(
    JSON.stringify({
      message: `Workflow ${isActive ? 'activated' : 'deactivated'} successfully`,
      workflow: data,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function deleteWorkflow(supabaseClient: any, userId: string, workflowId: string) {
  const { error } = await supabaseClient
    .from('n8n_workflow_configs')
    .delete()
    .eq('id', workflowId)
    .eq('user_id', userId)

  if (error) throw error

  return new Response(
    JSON.stringify({ message: 'Workflow deleted successfully' }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
