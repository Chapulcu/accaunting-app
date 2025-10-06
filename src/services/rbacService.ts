/**
 * RBAC Service - Rol Bazlı Yetkilendirme Servisi
 */

import { supabase } from '@/lib/supabase'

export type ResourceType =
  | 'invoices'
  | 'expenses'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'users'

export type ActionType = 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export'

export interface Role {
  id: string
  user_id: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
}

export interface Permission {
  id: string
  resource: ResourceType
  action: ActionType
  description: string | null
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[]
}

export interface UserRoleAssignment {
  id: string
  owner_user_id: string
  assigned_user_id: string
  role_id: string
  is_active: boolean
  assigned_at: string
  role: Role
}

export const RBACService = {
  /**
   * Kullanıcının belirli bir kaynakta belirli bir işlemi yapma iznini kontrol et
   */
  async checkPermission(
    userId: string,
    resource: ResourceType,
    action: ActionType
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_user_permission', {
      p_user_id: userId,
      p_resource: resource,
      p_action: action,
    })

    if (error) {
      console.error('Permission check error:', error)
      return false
    }

    return data === true
  },

  /**
   * Tüm izinleri getir
   */
  async getAllPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('resource, action')

    if (error) throw error
    return data || []
  },

  /**
   * Kullanıcının rollerini oluştur
   */
  async createRole(
    userId: string,
    name: string,
    description: string,
    permissionIds: string[]
  ): Promise<string> {
    // 1. Rol oluştur
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        user_id: userId,
        name,
        description,
        is_system: false,
      })
      .select()
      .single()

    if (roleError) throw roleError

    // 2. İzinleri ekle
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId) => ({
        role_id: role.id,
        permission_id: permissionId,
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (permError) throw permError
    }

    return role.id
  },

  /**
   * Rolü güncelle
   */
  async updateRole(
    roleId: string,
    userId: string,
    name: string,
    description: string,
    permissionIds: string[]
  ): Promise<void> {
    // 1. Rol bilgisini güncelle
    const { error: updateError } = await supabase
      .from('roles')
      .update({ name, description })
      .eq('id', roleId)
      .eq('user_id', userId)

    if (updateError) throw updateError

    // 2. Mevcut izinleri sil
    await supabase.from('role_permissions').delete().eq('role_id', roleId)

    // 3. Yeni izinleri ekle
    if (permissionIds.length > 0) {
      const rolePermissions = permissionIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }))

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions)

      if (permError) throw permError
    }
  },

  /**
   * Kullanıcının rollerini getir
   */
  async getUserRoles(userId: string): Promise<RoleWithPermissions[]> {
    const { data, error } = await supabase
      .from('roles')
      .select(
        `
        *,
        role_permissions (
          permission_id,
          permissions (*)
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data
    return (data || []).map((role: any) => ({
      ...role,
      permissions: role.role_permissions.map((rp: any) => rp.permissions),
    }))
  },

  /**
   * Kullanıcıya rol ata
   */
  async assignRoleToUser(
    ownerUserId: string,
    assignedUserId: string,
    roleId: string
  ): Promise<void> {
    const { error } = await supabase.from('user_role_assignments').insert({
      owner_user_id: ownerUserId,
      assigned_user_id: assignedUserId,
      role_id: roleId,
      is_active: true,
      assigned_by: ownerUserId,
    })

    if (error) throw error
  },

  /**
   * Kullanıcının atanmış rollerini getir
   */
  async getAssignedRoles(userId: string): Promise<UserRoleAssignment[]> {
    const { data, error } = await supabase
      .from('user_role_assignments')
      .select(
        `
        *,
        roles (*)
      `
      )
      .eq('assigned_user_id', userId)
      .eq('is_active', true)

    if (error) throw error
    return (data || []) as UserRoleAssignment[]
  },

  /**
   * Rolü sil
   */
  async deleteRole(roleId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .eq('user_id', userId)
      .eq('is_system', false) // Sistem rolleri silinemez

    if (error) throw error
  },

  /**
   * Varsayılan rolleri oluştur (Admin, Manager, User)
   */
  async createDefaultRoles(userId: string): Promise<void> {
    const permissions = await this.getAllPermissions()

    // Admin - Tüm izinler
    const adminPermissions = permissions.map((p) => p.id)
    await this.createRole(userId, 'Admin', 'Tam yetki - Tüm işlemler', adminPermissions)

    // Manager - Okuma, oluşturma, güncelleme, onaylama
    const managerPermissions = permissions
      .filter((p) => ['read', 'create', 'update', 'approve', 'export'].includes(p.action))
      .map((p) => p.id)
    await this.createRole(
      userId,
      'Manager',
      'Yönetici - Onaylama yetkisi var',
      managerPermissions
    )

    // User - Sadece okuma ve oluşturma
    const userPermissions = permissions
      .filter((p) => ['read', 'create'].includes(p.action))
      .filter((p) => !['settings', 'users'].includes(p.resource))
      .map((p) => p.id)
    await this.createRole(userId, 'User', 'Kullanıcı - Temel işlemler', userPermissions)
  },
}
