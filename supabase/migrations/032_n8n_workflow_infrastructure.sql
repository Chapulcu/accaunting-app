-- Migration 032: n8n Workflow Infrastructure (OPTIONAL)
--
-- Purpose: Create tables and functions for n8n workflow automation
-- This migration is OPTIONAL - only run if n8n features will be used
-- All n8n features are controlled by n8n_enabled feature flag

-- n8n workflow configurations table
CREATE TABLE IF NOT EXISTS n8n_workflow_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- n8n workflow information
    n8n_workflow_id TEXT UNIQUE, -- n8n internal workflow ID
    workflow_name TEXT NOT NULL,
    workflow_type TEXT NOT NULL CHECK (workflow_type IN ('approval', 'reminder', 'recurring', 'sync', 'e-invoice')),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('webhook', 'schedule', 'manual')),

    -- Trigger configuration
    webhook_url TEXT, -- n8n webhook URL
    schedule_cron TEXT, -- Cron expression for scheduled workflows
    trigger_config JSONB DEFAULT '{}', -- Additional trigger configuration

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Statistics
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    last_execution_at TIMESTAMPTZ,
    last_execution_status TEXT,

    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_workflow_type CHECK (workflow_type IN ('approval', 'reminder', 'recurring', 'sync', 'e-invoice')),
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('webhook', 'schedule', 'manual')),
    CONSTRAINT webhook_url_when_webhook CHECK (
        (trigger_type = 'webhook' AND webhook_url IS NOT NULL) OR
        (trigger_type != 'webhook')
    ),
    CONSTRAINT schedule_when_schedule CHECK (
        (trigger_type = 'schedule' AND schedule_cron IS NOT NULL) OR
        (trigger_type != 'schedule')
    )
);

-- Webhook event logs table
CREATE TABLE IF NOT EXISTS webhook_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_config_id UUID REFERENCES n8n_workflow_configs(id) ON DELETE SET NULL,

    -- Event information
    event_type TEXT NOT NULL, -- 'invoice.created', 'payment.received', etc.
    entity_type TEXT NOT NULL, -- 'invoice', 'payment', 'expense', etc.
    entity_id INTEGER,

    -- Webhook details
    webhook_url TEXT,
    request_payload JSONB,
    response_code INTEGER,
    response_body TEXT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,

    -- n8n execution tracking
    n8n_execution_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled workflow tasks table
CREATE TABLE IF NOT EXISTS scheduled_workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_config_id UUID REFERENCES n8n_workflow_configs(id) ON DELETE CASCADE,

    task_name TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN ('recurring_invoice', 'payment_reminder', 'data_sync', 'custom')),

    -- Schedule
    cron_expression TEXT NOT NULL,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT,

    -- Configuration
    task_config JSONB DEFAULT '{}',

    -- Status
    is_active BOOLEAN DEFAULT true,
    execution_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_n8n_workflow_configs_user_id ON n8n_workflow_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_workflow_configs_type ON n8n_workflow_configs(workflow_type);
CREATE INDEX IF NOT EXISTS idx_n8n_workflow_configs_active ON n8n_workflow_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_user_id ON webhook_event_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_status ON webhook_event_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_event_logs_created_at ON webhook_event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_workflow_tasks(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_id ON scheduled_workflow_tasks(user_id);

-- Enable Row Level Security
ALTER TABLE n8n_workflow_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_workflow_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for n8n_workflow_configs
CREATE POLICY "Users can view own n8n workflows"
    ON n8n_workflow_configs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own n8n workflows"
    ON n8n_workflow_configs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own n8n workflows"
    ON n8n_workflow_configs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own n8n workflows"
    ON n8n_workflow_configs FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for webhook_event_logs
CREATE POLICY "Users can view own webhook logs"
    ON webhook_event_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert webhook logs"
    ON webhook_event_logs FOR INSERT
    WITH CHECK (true); -- Edge functions use service role

-- RLS Policies for scheduled_workflow_tasks
CREATE POLICY "Users can manage own scheduled tasks"
    ON scheduled_workflow_tasks FOR ALL
    USING (auth.uid() = user_id);

-- Function to update workflow execution stats
CREATE OR REPLACE FUNCTION update_workflow_execution_stats(
    p_workflow_id UUID,
    p_success BOOLEAN,
    p_execution_status TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE n8n_workflow_configs
    SET
        total_executions = total_executions + 1,
        successful_executions = CASE WHEN p_success THEN successful_executions + 1 ELSE successful_executions END,
        failed_executions = CASE WHEN NOT p_success THEN failed_executions + 1 ELSE failed_executions END,
        last_execution_at = NOW(),
        last_execution_status = COALESCE(p_execution_status, CASE WHEN p_success THEN 'success' ELSE 'failed' END),
        updated_at = NOW()
    WHERE id = p_workflow_id;
END;
$$;

-- Function to get active workflows by type
CREATE OR REPLACE FUNCTION get_active_workflows_by_type(
    p_workflow_type TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    workflow_name TEXT,
    webhook_url TEXT,
    trigger_config JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.workflow_name,
        w.webhook_url,
        w.trigger_config
    FROM n8n_workflow_configs w
    WHERE w.workflow_type = p_workflow_type
        AND w.is_active = true
        AND (p_user_id IS NULL OR w.user_id = p_user_id)
    ORDER BY w.created_at DESC;
END;
$$;

-- Comments for documentation
COMMENT ON TABLE n8n_workflow_configs IS 'n8n workflow configurations and metadata';
COMMENT ON TABLE webhook_event_logs IS 'Webhook event logs for n8n workflow triggers';
COMMENT ON TABLE scheduled_workflow_tasks IS 'Scheduled tasks for n8n workflows';
COMMENT ON FUNCTION update_workflow_execution_stats IS 'Update workflow execution statistics after each run';
COMMENT ON FUNCTION get_active_workflows_by_type IS 'Get active workflows filtered by type';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 032: n8n workflow infrastructure created successfully.';
    RAISE NOTICE 'Tables: n8n_workflow_configs, webhook_event_logs, scheduled_workflow_tasks';
    RAISE NOTICE 'This infrastructure is optional and controlled by n8n_enabled feature flag.';
END $$;
