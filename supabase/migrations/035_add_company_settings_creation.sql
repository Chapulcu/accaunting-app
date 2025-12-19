-- ================================================
-- ADD COMPANY_SETTINGS CREATION TO USER REGISTRATION
-- ================================================

-- Update the create_user_organization function to also create company_settings
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

  -- Create company_settings for user
  INSERT INTO company_settings (
    user_id,
    company_name,
    email,
    currency,
    tax_rate,
    invoice_prefix
  ) VALUES (
    NEW.id,
    COALESCE(NEW.company_name, NEW.full_name),
    NEW.email,
    'TRY',
    20.00,
    'INV'
  );

  RAISE NOTICE 'Created organization %, membership, and company_settings for user %', new_org_id, NEW.id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 035: Added company_settings creation';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✓ Updated create_user_organization() function';
    RAISE NOTICE '✓ Now creates company_settings for new users';
    RAISE NOTICE '==============================================';
END $$;
