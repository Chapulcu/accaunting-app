-- Migration 036: Recurring Invoices Automation Helper Functions
--
-- Purpose: Add SQL functions to support n8n workflow automation
-- for recurring invoices and payment reminders

-- ============================================================================
-- RECURRING INVOICES AUTOMATION
-- ============================================================================

-- Function to get recurring invoices that are due for generation
CREATE OR REPLACE FUNCTION get_due_recurring_invoices()
RETURNS TABLE (
    id UUID,
    user_id UUID,
    company_id INTEGER,
    company_name TEXT,
    company_email TEXT,
    next_invoice_date DATE,
    interval_type TEXT,
    interval_count INTEGER,
    total_generated INTEGER,
    currency TEXT,
    items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.user_id,
        r.company_id,
        c.name as company_name,
        c.email as company_email,
        r.next_invoice_date,
        r.interval_type,
        r.interval_count,
        r.total_generated,
        r.currency,
        -- Get items as JSONB array
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'description', ri.description,
                        'quantity', ri.quantity,
                        'unit_price', ri.unit_price,
                        'tax_rate', ri.tax_rate,
                        'discount_percentage', ri.discount_percentage
                    )
                )
                FROM recurring_invoice_items ri
                WHERE ri.recurring_invoice_id = r.id
            ),
            '[]'::jsonb
        ) as items
    FROM recurring_invoices r
    JOIN companies c ON c.id = r.company_id
    WHERE r.status = 'active'
      AND r.next_invoice_date <= CURRENT_DATE
      AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE)
    ORDER BY r.next_invoice_date ASC;
END;
$$;

-- Function to check if a recurring invoice should generate today
CREATE OR REPLACE FUNCTION should_generate_recurring_invoice(
    p_recurring_invoice_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_date DATE;
    v_status TEXT;
    v_end_date DATE;
BEGIN
    SELECT next_invoice_date, status, end_date
    INTO v_next_date, v_status, v_end_date
    FROM recurring_invoices
    WHERE id = p_recurring_invoice_id;

    -- Check if should generate
    IF v_status = 'active'
       AND v_next_date <= CURRENT_DATE
       AND (v_end_date IS NULL OR v_end_date >= CURRENT_DATE) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- ============================================================================
-- PAYMENT REMINDERS
-- ============================================================================

-- Function to get invoices that need payment reminders
CREATE OR REPLACE FUNCTION get_invoices_for_reminder(
    p_days_before_due INTEGER DEFAULT 3,
    p_include_overdue BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    invoice_id INTEGER,
    invoice_number TEXT,
    invoice_date DATE,
    due_date DATE,
    company_id INTEGER,
    company_name TEXT,
    company_email TEXT,
    total_amount DECIMAL,
    paid_amount DECIMAL,
    remaining_balance DECIMAL,
    days_until_due INTEGER,
    is_overdue BOOLEAN,
    overdue_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.company_id,
        c.name as company_name,
        c.email as company_email,
        i.total as total_amount,
        COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = i.id), 0
        )::DECIMAL as paid_amount,
        (i.total - COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = i.id), 0
        ))::DECIMAL as remaining_balance,
        (i.due_date - CURRENT_DATE)::INTEGER as days_until_due,
        (i.due_date < CURRENT_DATE) as is_overdue,
        CASE
            WHEN i.due_date < CURRENT_DATE THEN (CURRENT_DATE - i.due_date)::INTEGER
            ELSE 0
        END as overdue_days
    FROM invoices i
    JOIN companies c ON c.id = i.company_id
    WHERE i.status IN ('sent', 'draft')
      AND i.type = 'sale'
      -- Has remaining balance
      AND (i.total - COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = i.id), 0
        )) > 0
      AND (
          -- Due soon
          (i.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (p_days_before_due || ' days')::INTERVAL)
          OR
          -- Overdue (if enabled)
          (p_include_overdue AND i.due_date < CURRENT_DATE)
      )
    ORDER BY
        CASE WHEN i.due_date < CURRENT_DATE THEN 0 ELSE 1 END,  -- Overdue first
        i.due_date ASC;
END;
$$;

-- Function to create reminder records
CREATE OR REPLACE FUNCTION create_payment_reminder(
    p_invoice_id INTEGER,
    p_reminder_type TEXT DEFAULT 'due_soon',  -- 'due_soon', 'overdue'
    p_days_overdue INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reminder_id UUID;
    v_user_id UUID;
    v_company_id INTEGER;
    v_due_date DATE;
BEGIN
    -- Get invoice details
    SELECT user_id, company_id, due_date
    INTO v_user_id, v_company_id, v_due_date
    FROM invoices
    WHERE id = p_invoice_id;

    -- Insert reminder
    INSERT INTO reminders (
        user_id,
        type,
        entity_type,
        entity_id,
        company_id,
        reminder_date,
        status,
        notes
    )
    VALUES (
        v_user_id,
        'payment',
        'invoice',
        p_invoice_id,
        v_company_id,
        CASE
            WHEN p_reminder_type = 'overdue' THEN CURRENT_DATE
            ELSE v_due_date
        END,
        'pending',
        CASE
            WHEN p_reminder_type = 'overdue' THEN
                'Fatura ' || p_days_overdue || ' gün gecikmiş'
            ELSE
                'Fatura vadesi yaklaşıyor'
        END
    )
    RETURNING id INTO v_reminder_id;

    RETURN v_reminder_id;
END;
$$;

-- ============================================================================
-- WORKFLOW EXECUTION LOGGING
-- ============================================================================

-- Function to log workflow execution results
CREATE OR REPLACE FUNCTION log_workflow_execution(
    p_workflow_config_id UUID,
    p_success BOOLEAN,
    p_execution_status TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update workflow stats
    PERFORM update_workflow_execution_stats(
        p_workflow_config_id,
        p_success,
        p_execution_status
    );

    -- Log to webhook_event_logs if needed
    INSERT INTO webhook_event_logs (
        user_id,
        workflow_config_id,
        event_type,
        entity_type,
        status,
        request_payload,
        response_code,
        created_at
    )
    SELECT
        user_id,
        p_workflow_config_id,
        'workflow_execution',
        workflow_type,
        CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
        p_details,
        CASE WHEN p_success THEN 200 ELSE 500 END,
        NOW()
    FROM n8n_workflow_configs
    WHERE id = p_workflow_config_id;
END;
$$;

-- ============================================================================
-- STATISTICS AND MONITORING
-- ============================================================================

-- View for recurring invoice automation stats
CREATE OR REPLACE VIEW recurring_invoice_automation_stats AS
SELECT
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'paused') as paused_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE next_invoice_date <= CURRENT_DATE AND status = 'active') as due_today_count,
    COUNT(*) FILTER (WHERE next_invoice_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7 AND status = 'active') as due_this_week_count,
    SUM(total_generated) as total_invoices_generated,
    COUNT(DISTINCT company_id) as unique_companies
FROM recurring_invoices;

-- View for payment reminder stats
CREATE OR REPLACE VIEW payment_reminder_stats AS
SELECT
    COUNT(*) FILTER (WHERE due_date <= CURRENT_DATE AND status IN ('sent', 'draft')) as overdue_count,
    COUNT(*) FILTER (WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 AND status IN ('sent', 'draft')) as due_soon_count,
    SUM(
        total - COALESCE(
            (SELECT SUM(p.amount)
             FROM payments p
             WHERE p.invoice_id = invoices.id), 0
        )
    ) FILTER (WHERE due_date <= CURRENT_DATE) as total_overdue_amount,
    COUNT(DISTINCT company_id) FILTER (WHERE due_date <= CURRENT_DATE) as companies_with_overdue
FROM invoices
WHERE type = 'sale'
  AND status IN ('sent', 'draft');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_due_recurring_invoices IS 'Returns recurring invoices that should generate today';
COMMENT ON FUNCTION should_generate_recurring_invoice IS 'Checks if a recurring invoice should generate today';
COMMENT ON FUNCTION get_invoices_for_reminder IS 'Returns invoices that need payment reminders';
COMMENT ON FUNCTION create_payment_reminder IS 'Creates a payment reminder record';
COMMENT ON FUNCTION log_workflow_execution IS 'Logs n8n workflow execution results';

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 036: Recurring invoice automation helpers created successfully.';
    RAISE NOTICE 'Functions: get_due_recurring_invoices, get_invoices_for_reminder, create_payment_reminder';
    RAISE NOTICE 'Views: recurring_invoice_automation_stats, payment_reminder_stats';
END $$;
