-- Rol Bazlı Yetkilendirme (RBAC) Sistemi

-- 1. Roller Tablosu
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- Sistem tarafından oluşturulan roller (silinemez)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, name)
);

-- 2. İzinler Tablosu
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    resource TEXT NOT NULL, -- 'invoices', 'expenses', 'payments', etc.
    action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'approve'
    description TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(resource, action)
);

-- 3. Rol-İzin İlişkisi
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(role_id, permission_id)
);

-- 4. Kullanıcı-Rol Atama
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Şirket sahibi
    assigned_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Atanan kullanıcı
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,

    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(owner_user_id, assigned_user_id, role_id)
);

-- 5. Onay Akışları Tablosu
CREATE TABLE IF NOT EXISTS approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'invoice', 'expense', 'payment'
    is_active BOOLEAN DEFAULT true,

    -- Tetikleyici koşullar
    trigger_conditions JSONB, -- {"amount_threshold": 10000, "category": "marketing"}

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Onay Akışı Adımları
CREATE TABLE IF NOT EXISTS approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,

    step_order INTEGER NOT NULL,
    approver_role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    required BOOLEAN DEFAULT true, -- Bu adım zorunlu mu?
    timeout_hours INTEGER, -- Onay için max süre

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(workflow_id, step_order)
);

-- 7. Onay İstekleri
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES approval_workflows(id) ON DELETE SET NULL,

    resource_type TEXT NOT NULL,
    resource_id INTEGER NOT NULL, -- invoice_id, expense_id, etc.

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    current_step INTEGER DEFAULT 1,

    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Onay Geçmişi
CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,

    step_order INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES auth.users(id),

    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'forwarded')),
    comments TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Hatırlatmalar Tablosu
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    message TEXT,
    reminder_type TEXT NOT NULL CHECK (reminder_type IN ('invoice_due', 'payment_due', 'approval_pending', 'custom')),

    -- İlgili kayıt
    resource_type TEXT, -- 'invoice', 'payment', 'approval'
    resource_id INTEGER,

    remind_at TIMESTAMPTZ NOT NULL,
    reminded BOOLEAN DEFAULT false,
    reminded_at TIMESTAMPTZ,

    -- Tekrarlama
    recurring BOOLEAN DEFAULT false,
    recurrence_rule TEXT, -- RRULE format (daily, weekly, monthly)

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_roles_user_id ON roles(user_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_user_role_assignments_owner ON user_role_assignments(owner_user_id);
CREATE INDEX idx_user_role_assignments_assigned ON user_role_assignments(assigned_user_id);
CREATE INDEX idx_approval_workflows_user_id ON approval_workflows(user_id);
CREATE INDEX idx_approval_workflow_steps_workflow_id ON approval_workflow_steps(workflow_id);
CREATE INDEX idx_approval_requests_user_id ON approval_requests(user_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_history_request_id ON approval_history(approval_request_id);
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_remind_at ON reminders(remind_at);
CREATE INDEX idx_reminders_reminded ON reminders(reminded);

-- RLS Policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Roles policies
CREATE POLICY "Users can manage own roles" ON roles
    FOR ALL USING (auth.uid() = user_id);

-- Permissions - herkes okuyabilir
CREATE POLICY "Everyone can read permissions" ON permissions
    FOR SELECT USING (true);

-- Role permissions
CREATE POLICY "Users can manage role permissions for own roles" ON role_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM roles
            WHERE roles.id = role_permissions.role_id
            AND roles.user_id = auth.uid()
        )
    );

-- User role assignments
CREATE POLICY "Users can manage role assignments" ON user_role_assignments
    FOR ALL USING (auth.uid() = owner_user_id);

-- Approval workflows
CREATE POLICY "Users can manage own approval workflows" ON approval_workflows
    FOR ALL USING (auth.uid() = user_id);

-- Approval workflow steps
CREATE POLICY "Users can manage workflow steps" ON approval_workflow_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM approval_workflows
            WHERE approval_workflows.id = approval_workflow_steps.workflow_id
            AND approval_workflows.user_id = auth.uid()
        )
    );

-- Approval requests - hem oluşturan hem de onaylayıcı görebilir
CREATE POLICY "Users can view relevant approval requests" ON approval_requests
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() = requested_by OR
        EXISTS (
            SELECT 1 FROM user_role_assignments ura
            JOIN approval_workflow_steps aws ON ura.role_id = aws.approver_role_id
            WHERE aws.workflow_id = approval_requests.workflow_id
            AND ura.assigned_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create approval requests" ON approval_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = requested_by);

CREATE POLICY "Users can update own approval requests" ON approval_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- Approval history
CREATE POLICY "Users can view approval history" ON approval_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM approval_requests
            WHERE approval_requests.id = approval_history.approval_request_id
            AND (approval_requests.user_id = auth.uid() OR approval_requests.requested_by = auth.uid())
        )
    );

CREATE POLICY "Approvers can create approval history" ON approval_history
    FOR INSERT WITH CHECK (auth.uid() = approver_id);

-- Reminders
CREATE POLICY "Users can manage own reminders" ON reminders
    FOR ALL USING (auth.uid() = user_id);

-- Triggers
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_approval_workflows_updated_at
    BEFORE UPDATE ON approval_workflows
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Varsayılan İzinleri Ekle
INSERT INTO permissions (resource, action, description) VALUES
    ('invoices', 'create', 'Fatura oluşturma'),
    ('invoices', 'read', 'Fatura görüntüleme'),
    ('invoices', 'update', 'Fatura düzenleme'),
    ('invoices', 'delete', 'Fatura silme'),
    ('invoices', 'approve', 'Fatura onaylama'),

    ('expenses', 'create', 'Gider oluşturma'),
    ('expenses', 'read', 'Gider görüntüleme'),
    ('expenses', 'update', 'Gider düzenleme'),
    ('expenses', 'delete', 'Gider silme'),
    ('expenses', 'approve', 'Gider onaylama'),

    ('payments', 'create', 'Ödeme oluşturma'),
    ('payments', 'read', 'Ödeme görüntüleme'),
    ('payments', 'update', 'Ödeme düzenleme'),
    ('payments', 'delete', 'Ödeme silme'),
    ('payments', 'approve', 'Ödeme onaylama'),

    ('reports', 'read', 'Rapor görüntüleme'),
    ('reports', 'export', 'Rapor dışa aktarma'),

    ('settings', 'read', 'Ayarları görüntüleme'),
    ('settings', 'update', 'Ayarları düzenleme'),

    ('users', 'create', 'Kullanıcı ekleme'),
    ('users', 'read', 'Kullanıcı görüntüleme'),
    ('users', 'update', 'Kullanıcı düzenleme'),
    ('users', 'delete', 'Kullanıcı silme')
ON CONFLICT (resource, action) DO NOTHING;

-- Helper Function: Kullanıcının iznini kontrol et
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_resource TEXT,
    p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_permission BOOLEAN;
BEGIN
    -- Kendi verisi ise her zaman izinli
    -- Atanmış rollerdeki izinleri kontrol et
    SELECT EXISTS (
        SELECT 1
        FROM user_role_assignments ura
        JOIN role_permissions rp ON ura.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ura.assigned_user_id = p_user_id
        AND ura.is_active = true
        AND p.resource = p_resource
        AND p.action = p_action
    ) INTO v_has_permission;

    RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE roles IS 'Kullanıcı rolleri';
COMMENT ON TABLE permissions IS 'Sistem izinleri';
COMMENT ON TABLE approval_workflows IS 'Onay akışları tanımları';
COMMENT ON TABLE approval_requests IS 'Onay bekleyen istekler';
COMMENT ON TABLE reminders IS 'Otomatik hatırlatmalar';
