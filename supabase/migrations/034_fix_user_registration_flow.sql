-- ================================================
-- FIX USER REGISTRATION FLOW
-- Fixes broken triggers, RLS policies, and auto-organization creation
-- ================================================

-- ================================================
-- STEP 1: Remove broken initialize_user_data trigger
-- ================================================

DROP TRIGGER IF EXISTS initialize_new_user_data ON profiles;
DROP FUNCTION IF EXISTS initialize_user_data();

DO $$
BEGIN
    RAISE NOTICE 'Removed broken initialize_user_data trigger';
END $$;

-- ================================================
-- STEP 2: Fix organization_members RLS policies (prevent infinite recursion)
-- ================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "System can insert members" ON organization_members;
DROP POLICY IF EXISTS "Owner/Admin can update members" ON organization_members;
DROP POLICY IF EXISTS "Owner/Admin can remove members" ON organization_members;

-- Simple non-recursive policies
-- Users can view their own membership records
CREATE POLICY "Users can view own membership" ON organization_members
    FOR SELECT USING (user_id = auth.uid());

-- System can insert (for registration and invitations)
CREATE POLICY "Allow insert members" ON organization_members
    FOR INSERT WITH CHECK (true);

-- Users can update their own membership preferences
CREATE POLICY "Users can update own membership" ON organization_members
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own membership (leave organization)
CREATE POLICY "Users can delete own membership" ON organization_members
    FOR DELETE USING (user_id = auth.uid());

DO $$
BEGIN
    RAISE NOTICE 'Fixed organization_members RLS policies (no more infinite recursion)';
END $$;

-- ================================================
-- STEP 3: Create trigger for auto-organization creation
-- ================================================

CREATE OR REPLACE FUNCTION create_user_organization()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_org_id UUID;
  org_slug TEXT;
BEGIN
  -- Generate unique slug
  org_slug := LOWER(REPLACE(COALESCE(NEW.company_name, NEW.full_name, NEW.email), ' ', '-'));
  org_slug := org_slug || '-' || substring(NEW.id::text from 1 for 8);

  -- Create organization
  INSERT INTO organizations (
    name,
    slug,
    description,
    country,
    currency,
    tax_rate,
    invoice_prefix,
    fiscal_year_start,
    subscription_plan,
    subscription_status,
    owner_id,
    settings
  ) VALUES (
    COALESCE(NEW.company_name, NEW.full_name, 'Şirketim'),
    org_slug,
    'Otomatik oluşturuldu',
    'TR',
    'TRY',
    20,
    'INV',
    1,
    'free',
    'trial',
    NEW.id,
    '{}'::jsonb
  ) RETURNING id INTO new_org_id;

  -- Create organization membership for user as owner
  INSERT INTO organization_members (
    organization_id,
    user_id,
    role,
    status,
    preferences
  ) VALUES (
    new_org_id,
    NEW.id,
    'owner',
    'active',
    '{}'::jsonb
  );

  RAISE NOTICE 'Created organization % for user %', new_org_id, NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (runs after profile is created)
DROP TRIGGER IF EXISTS create_user_organization_trigger ON profiles;
CREATE TRIGGER create_user_organization_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_organization();

DO $$
BEGIN
    RAISE NOTICE 'Created auto-organization trigger for new users';
END $$;

-- ================================================
-- STEP 4: Fix app_settings RLS policies
-- ================================================

-- app_settings is a singleton table (id always 1)
-- Drop user-specific policies and create simple ones

DROP POLICY IF EXISTS "Users can view own app settings" ON app_settings;
DROP POLICY IF EXISTS "Users can update own app settings" ON app_settings;
DROP POLICY IF EXISTS "Users can insert own app settings" ON app_settings;

-- Anyone can view app settings (it's global config)
CREATE POLICY "Anyone can view app settings" ON app_settings
    FOR SELECT USING (true);

-- Only admins can update app settings
CREATE POLICY "Admins can update app settings" ON app_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );

-- Create default app_settings record if not exists
INSERT INTO app_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Fixed app_settings RLS policies';
END $$;

-- ================================================
-- STEP 5: Update organizations RLS policies (fix recursion)
-- ================================================

-- Drop policies that might cause recursion
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Owner/Admin can update organization" ON organizations;
DROP POLICY IF EXISTS "Only owner can delete organization" ON organizations;

-- Recreate with SECURITY DEFINER helper function to avoid recursion
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS TABLE(org_id UUID)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

-- Members can view their organization (using helper function)
CREATE POLICY "Members can view their organization" ON organizations
    FOR SELECT USING (
        id IN (SELECT org_id FROM get_user_organization_ids())
    );

-- Owner/Admin can update organization (using helper function)
CREATE POLICY "Owner/Admin can update organization" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Only owner can delete organization
CREATE POLICY "Only owner can delete organization" ON organizations
    FOR DELETE USING (
        id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
              AND role = 'owner'
              AND status = 'active'
        )
    );

DO $$
BEGIN
    RAISE NOTICE 'Fixed organizations RLS policies';
END $$;

-- ================================================
-- FINAL NOTIFICATION
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 034: User registration flow fixed!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✓ Removed broken initialize_user_data trigger';
    RAISE NOTICE '✓ Fixed organization_members RLS (no recursion)';
    RAISE NOTICE '✓ Added auto-organization creation for new users';
    RAISE NOTICE '✓ Fixed app_settings policies (singleton pattern)';
    RAISE NOTICE '✓ Fixed organizations RLS policies';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'New users will now automatically get:';
    RAISE NOTICE '  1. Profile created (via handle_new_user)';
    RAISE NOTICE '  2. Organization created (via create_user_organization)';
    RAISE NOTICE '  3. Owner membership assigned';
    RAISE NOTICE '==============================================';
END $$;
