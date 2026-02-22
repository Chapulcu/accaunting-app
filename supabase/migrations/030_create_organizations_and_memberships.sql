-- ================================================
-- ORGANIZATIONS & MEMBERSHIPS TABLES
-- Multi-tenant SaaS infrastructure for company management
-- ================================================

-- Organizations Table (Companies/Tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Basic Info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
    description TEXT,

    -- Tax & Legal
    tax_number TEXT,
    tax_office TEXT,

    -- Contact Info
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'TR',
    postal_code TEXT,
    website TEXT,

    -- Accounting Settings
    currency TEXT DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
    tax_rate DECIMAL(5,2) DEFAULT 20.00, -- Default VAT rate
    invoice_prefix TEXT DEFAULT 'INV', -- Invoice number prefix
    fiscal_year_start INTEGER DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12), -- Fiscal year start month

    -- Subscription & Billing (for future use)
    subscription_plan TEXT DEFAULT 'free' CHECK (subscription_plan IN ('free', 'starter', 'business', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
    trial_ends_at TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,

    -- Meta
    logo_url TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Primary owner
    settings JSONB DEFAULT '{}', -- Additional settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members (User-to-Organization Relationship)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role in Organization
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('owner', 'admin', 'accountant', 'user')),

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_invitation', 'active', 'suspended', 'removed')),

    -- Metadata
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    removed_at TIMESTAMPTZ,

    -- Preferences
    preferences JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id), -- Each user can only be in ONE organization (1:1 relationship)
    UNIQUE(organization_id, user_id) -- Redundant but explicit
);

-- Organization Invitations
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Invitation Details
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'accountant', 'user')),
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    -- Status & Expiry
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'canceled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Metadata
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,

    -- Message
    invitation_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(organization_id, email, status) -- Prevent duplicate pending invitations
);

-- ================================================
-- INDEXES
-- ================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

-- Organization Members
CREATE INDEX idx_organization_members_organization_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);
CREATE INDEX idx_organization_members_status ON organization_members(status);

-- Organization Invitations
CREATE INDEX idx_organization_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX idx_organization_invitations_email ON organization_invitations(email);
CREATE INDEX idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX idx_organization_invitations_expires_at ON organization_invitations(expires_at);

-- ================================================
-- TRIGGERS
-- ================================================

-- Update updated_at timestamp for organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for organization_members
CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at timestamp for organization_invitations
CREATE TRIGGER update_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-expire invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE organization_invitations
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expire_invitations
    AFTER INSERT OR UPDATE ON organization_invitations
    FOR EACH STATEMENT
    EXECUTE FUNCTION expire_old_invitations();

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Organizations Policies
-- Members can view their organization
CREATE POLICY "Members can view their organization" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
              AND organization_members.user_id = auth.uid()
              AND organization_members.status = 'active'
        )
    );

-- Owner/Admin can update organization
CREATE POLICY "Owner/Admin can update organization" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
              AND organization_members.user_id = auth.uid()
              AND organization_members.role IN ('owner', 'admin')
              AND organization_members.status = 'active'
        )
    );

-- Anyone can create organization (for self-registration)
CREATE POLICY "Anyone can create organization" ON organizations
    FOR INSERT WITH CHECK (true);

-- Only owner can delete organization
CREATE POLICY "Only owner can delete organization" ON organizations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_members.organization_id = organizations.id
              AND organization_members.user_id = auth.uid()
              AND organization_members.role = 'owner'
              AND organization_members.status = 'active'
        )
    );

-- Organization Members Policies
-- Members can view other members in their organization
CREATE POLICY "Members can view organization members" ON organization_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_members.organization_id
              AND user_id = auth.uid()
              AND status = 'active'
        )
    );

-- System can insert members (via invitation acceptance or org creation)
CREATE POLICY "System can insert members" ON organization_members
    FOR INSERT WITH CHECK (true);

-- Owner/Admin can update members
CREATE POLICY "Owner/Admin can update members" ON organization_members
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_members.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Owner/Admin can remove members (but not themselves or last owner)
CREATE POLICY "Owner/Admin can remove members" ON organization_members
    FOR DELETE USING (
        user_id != auth.uid() -- Can't remove self
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_members.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Organization Invitations Policies
-- Members can view invitations in their organization
CREATE POLICY "Members can view organization invitations" ON organization_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_invitations.organization_id
              AND user_id = auth.uid()
              AND status = 'active'
        )
    );

-- Owner/Admin can create invitations
CREATE POLICY "Owner/Admin can create invitations" ON organization_invitations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_invitations.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Owner/Admin can update invitations
CREATE POLICY "Owner/Admin can update invitations" ON organization_invitations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_invitations.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Owner/Admin can delete invitations
CREATE POLICY "Owner/Admin can delete invitations" ON organization_invitations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = organization_invitations.organization_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
              AND status = 'active'
        )
    );

-- Public can view invitation by token (for acceptance page)
CREATE POLICY "Public can view invitation by token" ON organization_invitations
    FOR SELECT USING (
        token IS NOT NULL
        AND status = 'pending'
        AND expires_at > NOW()
    );

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id
    FROM organization_members
    WHERE user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has specific role in their organization
CREATE OR REPLACE FUNCTION public.has_organization_role(required_role TEXT)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND role = required_role
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user has one of the specified roles
CREATE OR REPLACE FUNCTION public.has_any_organization_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
          AND status = 'active'
          AND role = ANY(required_roles)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get user's role in their organization
CREATE OR REPLACE FUNCTION public.user_organization_role()
RETURNS TEXT AS $$
    SELECT role
    FROM organization_members
    WHERE user_id = auth.uid()
      AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ================================================
-- NOTIFICATION
-- ================================================

DO $$
BEGIN
    RAISE NOTICE 'Organizations and memberships tables created successfully';
    RAISE NOTICE 'Helper functions created: user_organization_id(), has_organization_role(), has_any_organization_role(), user_organization_role()';
    RAISE NOTICE 'RLS policies enabled for multi-tenant data isolation';
END $$;
