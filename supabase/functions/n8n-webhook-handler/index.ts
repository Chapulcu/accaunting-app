// N8N Webhook Handler Edge Function
// Handles incoming events and triggers configured n8n workflows

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookEvent {
  event_type: string // 'invoice.created', 'payment.received', etc.
  entity_type: string // 'invoice', 'payment', 'expense', etc.
  entity_id: number
  entity_data?: any
  user_id?: string
}

interface WorkflowConfig {
  id: string
  workflow_name: string
  webhook_url: string
  trigger_config: any
  user_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse incoming event
    const event: WebhookEvent = await req.json()
    console.log('Received webhook event:', event)

    // Validate event
    if (!event.event_type || !event.entity_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event_type, entity_type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if n8n is enabled for this user
    if (event.user_id) {
      const { data: settings } = await supabaseClient
        .from('app_settings')
        .select('n8n_enabled')
        .limit(1)
        .single()

      if (!settings?.n8n_enabled) {
        console.log('n8n is disabled, skipping webhook')
        return new Response(
          JSON.stringify({ message: 'n8n feature is disabled' }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
    }

    // Find active workflows for this event type
    const { data: workflows, error: workflowError } = await supabaseClient
      .from('n8n_workflow_configs')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', 'webhook')
      .or(`workflow_type.eq.${mapEventToWorkflowType(event.event_type)},workflow_type.eq.custom`)

    if (workflowError) {
      console.error('Error fetching workflows:', workflowError)
      throw workflowError
    }

    if (!workflows || workflows.length === 0) {
      console.log('No active workflows found for event:', event.event_type)
      return new Response(
        JSON.stringify({ message: 'No active workflows configured for this event' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Trigger each workflow
    const results = await Promise.allSettled(
      workflows.map((workflow: WorkflowConfig) =>
        triggerWorkflow(supabaseClient, workflow, event)
      )
    )

    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    console.log(`Triggered ${successful} workflows successfully, ${failed} failed`)

    return new Response(
      JSON.stringify({
        message: 'Workflows triggered',
        successful,
        failed,
        total: workflows.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error handling webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function triggerWorkflow(
  supabaseClient: any,
  workflow: WorkflowConfig,
  event: WebhookEvent
) {
  const logEntry = {
    user_id: event.user_id || workflow.user_id,
    workflow_config_id: workflow.id,
    event_type: event.event_type,
    entity_type: event.entity_type,
    entity_id: event.entity_id,
    webhook_url: workflow.webhook_url,
    request_payload: {
      event,
      workflow_name: workflow.workflow_name,
      timestamp: new Date().toISOString(),
    },
    status: 'pending',
  }

  try {
    console.log(`Triggering workflow: ${workflow.workflow_name} at ${workflow.webhook_url}`)

    // Call n8n webhook
    const response = await fetch(workflow.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(logEntry.request_payload),
    })

    const responseText = await response.text()

    // Log the webhook call
    await supabaseClient.from('webhook_event_logs').insert({
      ...logEntry,
      response_code: response.status,
      response_body: responseText,
      status: response.ok ? 'sent' : 'failed',
      error_message: response.ok ? null : `HTTP ${response.status}: ${responseText}`,
    })

    // Update workflow execution stats
    await supabaseClient.rpc('update_workflow_execution_stats', {
      p_workflow_id: workflow.id,
      p_success: response.ok,
      p_execution_status: response.ok ? 'success' : 'failed',
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}: ${responseText}`)
    }

    console.log(`Workflow ${workflow.workflow_name} triggered successfully`)
    return { success: true, workflow: workflow.workflow_name }
  } catch (error) {
    console.error(`Error triggering workflow ${workflow.workflow_name}:`, error)

    // Log the failure
    await supabaseClient.from('webhook_event_logs').insert({
      ...logEntry,
      status: 'failed',
      error_message: error.message,
    })

    throw error
  }
}

function mapEventToWorkflowType(eventType: string): string {
  // Map event types to workflow types
  const mapping: Record<string, string> = {
    'invoice.created': 'approval',
    'invoice.pending_approval': 'approval',
    'invoice.approved': 'sync',
    'payment.overdue': 'reminder',
    'payment.due_soon': 'reminder',
    'recurring.invoice_due': 'recurring',
    'sync.data_update': 'sync',
    'e-invoice.ready': 'e-invoice',
  }

  return mapping[eventType] || 'custom'
}
