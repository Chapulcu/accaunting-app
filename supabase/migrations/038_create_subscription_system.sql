-- ============================================================================
-- Migration: 038_create_subscription_system.sql
-- Description: SaaS subscription system with feature flags and usage tracking
-- Author: AI Assistant
-- Created: 2024-12-29
-- ============================================================================

-- ============================================================================
-- 1. TIER_FEATURES TABLE
-- Defines available features and limits for each subscription tier
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tier_features (
    tier TEXT PRIMARY KEY CHECK (tier IN ('starter', 'professional', 'enterprise')),
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    price_yearly DECIMAL(10,2),
    currency TEXT NOT NULL DEFAULT 'TRY',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;

-- Anyone can read tier features (for pricing page)
CREATE POLICY "tier_features_select_all" ON public.tier_features
    FOR SELECT USING (true);

-- Only admins can modify tier features
CREATE POLICY "tier_features_admin_only" ON public.tier_features
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Add updated_at trigger
CREATE TRIGGER set_tier_features_updated_at
    BEFORE UPDATE ON public.tier_features
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default tier configurations
INSERT INTO public.tier_features (tier, features, limits, price_monthly, price_yearly, description) VALUES
(
    'starter',
    '["auth", "invoices", "expenses", "basic_reports", "chart_of_accounts", "customers", "dashboard", "pdf_export", "csv_export"]'::jsonb,
    '{
        "max_invoices_per_month": 100,
        "max_users": 1,
        "max_customers": 50,
        "max_suppliers": 50,
        "currencies": ["TRY"],
        "storage_mb": 500,
        "api_calls_per_day": 0
    }'::jsonb,
    999.00,
    9600.00,
    'Serbest çalışanlar ve tek kişilik işletmeler için ideal başlangıç paketi'
),
(
    'professional',
    '["auth", "invoices", "expenses", "basic_reports", "advanced_reports", "chart_of_accounts", "customers", "dashboard", "pdf_export", "csv_export", "excel_export", "payments", "multi_currency", "exchange_rates", "recurring_invoices", "email_integration", "team_management", "rbac", "approval_workflows", "bank_accounts", "period_close"]'::jsonb,
    '{
        "max_invoices_per_month": -1,
        "max_users": 5,
        "max_customers": -1,
        "max_suppliers": -1,
        "currencies": ["TRY", "USD", "EUR", "GBP"],
        "storage_mb": 5000,
        "api_calls_per_day": 1000
    }'::jsonb,
    2699.00,
    25990.00,
    'Büyüyen işletmeler ve mali müşavirler için gelişmiş özellikler'
),
(
    'enterprise',
    '["all"]'::jsonb,
    '{
        "max_invoices_per_month": -1,
        "max_users": -1,
        "max_customers": -1,
        "max_suppliers": -1,
        "currencies": ["all"],
        "storage_mb": -1,
        "api_calls_per_day": -1,
        "ai_ocr_scans_per_month": 500,
        "ai_chat_messages_per_month": 1000,
        "n8n_workflow_executions_per_month": -1
    }'::jsonb,
    8500.00,
    81600.00,
    'Büyük firmalar için AI, otomasyon ve sınırsız kullanım'
)
ON CONFLICT (tier) DO UPDATE SET
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    description = EXCLUDED.description,
    updated_at = NOW();

-- ============================================================================
-- 2. SUBSCRIPTIONS TABLE
-- Stores subscription information for each organization
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'professional', 'enterprise')),
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'trial', 'cancelled', 'expired', 'past_due', 'unpaid')),

    -- Billing cycle
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    trial_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,

    -- Stripe integration
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id),
    CONSTRAINT valid_trial_period CHECK (
        (status = 'trial' AND trial_ends_at IS NOT NULL) OR
        (status != 'trial')
    )
);

-- Add indexes
CREATE INDEX idx_subscriptions_organization_id ON public.subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_period_end ON public.subscriptions(current_period_end);

-- Add RLS policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their organization's subscription
CREATE POLICY "subscriptions_select_own_org" ON public.subscriptions
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Only organization owners can update subscription
CREATE POLICY "subscriptions_update_owner" ON public.subscriptions
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- System can insert subscriptions
CREATE POLICY "subscriptions_insert_system" ON public.subscriptions
    FOR INSERT WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. FEATURE_FLAGS TABLE
-- Per-organization feature overrides (manual enables/disables)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, feature_key)
);

-- Add indexes
CREATE INDEX idx_feature_flags_org_id ON public.feature_flags(organization_id);
CREATE INDEX idx_feature_flags_feature_key ON public.feature_flags(feature_key);
CREATE INDEX idx_feature_flags_enabled ON public.feature_flags(enabled);

-- Add RLS policies
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Users can read their organization's feature flags
CREATE POLICY "feature_flags_select_own_org" ON public.feature_flags
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Only admins can modify feature flags
CREATE POLICY "feature_flags_admin_only" ON public.feature_flags
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Add updated_at trigger
CREATE TRIGGER set_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. USAGE_TRACKING TABLE
-- Tracks usage metrics per organization per period
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'invoices',
        'users',
        'customers',
        'suppliers',
        'api_calls',
        'storage_mb',
        'ai_ocr_scans',
        'ai_chat_messages',
        'n8n_executions',
        'email_sent'
    )),
    metric_value INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, metric_type, period_start)
);

-- Add indexes
CREATE INDEX idx_usage_tracking_org_id ON public.usage_tracking(organization_id);
CREATE INDEX idx_usage_tracking_metric_type ON public.usage_tracking(metric_type);
CREATE INDEX idx_usage_tracking_period ON public.usage_tracking(period_start, period_end);

-- Add RLS policies
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can read their organization's usage
CREATE POLICY "usage_tracking_select_own_org" ON public.usage_tracking
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- System can insert/update usage
CREATE POLICY "usage_tracking_system_write" ON public.usage_tracking
    FOR ALL USING (true);

-- Add updated_at trigger
CREATE TRIGGER set_usage_tracking_updated_at
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get current subscription for an organization
CREATE OR REPLACE FUNCTION public.get_organization_subscription(org_id UUID)
RETURNS TABLE (
    tier TEXT,
    status TEXT,
    features JSONB,
    limits JSONB,
    is_trial BOOLEAN,
    trial_days_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.tier,
        s.status,
        tf.features,
        tf.limits,
        (s.status = 'trial') AS is_trial,
        CASE
            WHEN s.trial_ends_at IS NOT NULL THEN
                GREATEST(0, EXTRACT(DAY FROM (s.trial_ends_at - NOW()))::INTEGER)
            ELSE 0
        END AS trial_days_remaining
    FROM public.subscriptions s
    JOIN public.tier_features tf ON s.tier = tf.tier
    WHERE s.organization_id = org_id
    AND (s.status = 'active' OR s.status = 'trial');
END;
$$;

-- Function to check if a feature is enabled for an organization
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
    org_id UUID,
    feature_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    subscription_tier TEXT;
    tier_features JSONB;
    feature_override BOOLEAN;
BEGIN
    -- Check for manual feature flag override
    SELECT enabled INTO feature_override
    FROM public.feature_flags
    WHERE organization_id = org_id
    AND feature_key = feature_name
    AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
        RETURN feature_override;
    END IF;

    -- Get tier features
    SELECT s.tier, tf.features INTO subscription_tier, tier_features
    FROM public.subscriptions s
    JOIN public.tier_features tf ON s.tier = tf.tier
    WHERE s.organization_id = org_id
    AND (s.status = 'active' OR s.status = 'trial');

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Check if 'all' features are enabled (enterprise)
    IF tier_features ? 'all' THEN
        RETURN true;
    END IF;

    -- Check if specific feature is in the tier
    RETURN tier_features ? feature_name;
END;
$$;

-- Function to check usage limit
CREATE OR REPLACE FUNCTION public.check_usage_limit(
    org_id UUID,
    limit_type TEXT,
    OUT allowed BOOLEAN,
    OUT current_usage INTEGER,
    OUT limit_value INTEGER,
    OUT percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tier_limits JSONB;
    limit_key TEXT;
BEGIN
    -- Get tier limits
    SELECT tf.limits INTO tier_limits
    FROM public.subscriptions s
    JOIN public.tier_features tf ON s.tier = tf.tier
    WHERE s.organization_id = org_id
    AND (s.status = 'active' OR s.status = 'trial');

    IF NOT FOUND THEN
        allowed := false;
        current_usage := 0;
        limit_value := 0;
        percentage := 0;
        RETURN;
    END IF;

    -- Build limit key
    limit_key := 'max_' || limit_type || '_per_month';
    IF NOT (tier_limits ? limit_key) THEN
        limit_key := 'max_' || limit_type;
    END IF;

    -- Get limit value (-1 means unlimited)
    limit_value := (tier_limits ->> limit_key)::INTEGER;

    -- Get current usage for this month
    SELECT COALESCE(metric_value, 0) INTO current_usage
    FROM public.usage_tracking
    WHERE organization_id = org_id
    AND metric_type = limit_type
    AND period_start = date_trunc('month', NOW())
    AND period_end = date_trunc('month', NOW()) + INTERVAL '1 month';

    IF NOT FOUND THEN
        current_usage := 0;
    END IF;

    -- Check if allowed
    IF limit_value = -1 THEN
        allowed := true;
        percentage := 0;
    ELSE
        allowed := current_usage < limit_value;
        IF limit_value > 0 THEN
            percentage := ROUND((current_usage::NUMERIC / limit_value::NUMERIC) * 100, 2);
        ELSE
            percentage := 0;
        END IF;
    END IF;
END;
$$;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION public.increment_usage(
    org_id UUID,
    metric TEXT,
    increment_by INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    period_start_date TIMESTAMPTZ;
    period_end_date TIMESTAMPTZ;
BEGIN
    period_start_date := date_trunc('month', NOW());
    period_end_date := period_start_date + INTERVAL '1 month';

    INSERT INTO public.usage_tracking (
        organization_id,
        metric_type,
        metric_value,
        period_start,
        period_end
    ) VALUES (
        org_id,
        metric,
        increment_by,
        period_start_date,
        period_end_date
    )
    ON CONFLICT (organization_id, metric_type, period_start)
    DO UPDATE SET
        metric_value = usage_tracking.metric_value + increment_by,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- 6. TRIGGERS FOR AUTOMATIC USAGE TRACKING
-- ============================================================================

-- Track invoice creation
CREATE OR REPLACE FUNCTION public.track_invoice_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only count on insert
    IF TG_OP = 'INSERT' THEN
        PERFORM public.increment_usage(
            (SELECT organization_id FROM public.profiles WHERE id = NEW.user_id),
            'invoices',
            1
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_invoice_usage
    AFTER INSERT ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.track_invoice_usage();

-- Track organization member additions
CREATE OR REPLACE FUNCTION public.track_user_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.increment_usage(NEW.organization_id, 'users', 1);
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.increment_usage(OLD.organization_id, 'users', -1);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_track_user_usage
    AFTER INSERT OR DELETE ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.track_user_usage();

-- ============================================================================
-- 7. DEFAULT SUBSCRIPTION FOR EXISTING ORGANIZATIONS
-- ============================================================================

-- Create trial subscriptions for all existing organizations
INSERT INTO public.subscriptions (organization_id, tier, status, trial_ends_at)
SELECT
    id,
    'professional'::TEXT,
    'trial'::TEXT,
    NOW() + INTERVAL '30 days'
FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.subscriptions)
ON CONFLICT (organization_id) DO NOTHING;

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.tier_features IS 'Defines features and limits for each subscription tier';
COMMENT ON TABLE public.subscriptions IS 'Stores subscription information for organizations';
COMMENT ON TABLE public.feature_flags IS 'Per-organization feature overrides';
COMMENT ON TABLE public.usage_tracking IS 'Tracks usage metrics per organization per period';

COMMENT ON FUNCTION public.get_organization_subscription IS 'Gets the current subscription details for an organization';
COMMENT ON FUNCTION public.is_feature_enabled IS 'Checks if a feature is enabled for an organization';
COMMENT ON FUNCTION public.check_usage_limit IS 'Checks if an organization has exceeded a usage limit';
COMMENT ON FUNCTION public.increment_usage IS 'Increments a usage counter for an organization';
