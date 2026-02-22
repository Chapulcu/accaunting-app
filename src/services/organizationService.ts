import { supabase } from '@/lib/supabase'

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  tax_number?: string
  tax_office?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country: string
  postal_code?: string
  website?: string
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP'
  tax_rate: number
  invoice_prefix: string
  fiscal_year_start: number
  subscription_plan: 'free' | 'starter' | 'business' | 'enterprise'
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended'
  trial_ends_at?: string
  subscription_ends_at?: string
  logo_url?: string
  owner_id?: string
  settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'accountant' | 'user'
  status: 'pending_invitation' | 'active' | 'suspended' | 'removed'
  invited_by?: string
  invited_at?: string
  joined_at: string
  removed_at?: string
  preferences: Record<string, any>
  created_at: string
  updated_at: string
}

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: 'admin' | 'accountant' | 'user'
  token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'canceled'
  expires_at: string
  invited_by?: string
  accepted_by?: string
  accepted_at?: string
  invitation_message?: string
  created_at: string
  updated_at: string
}

export interface CreateOrganizationData {
  name: string
  slug: string
  description?: string
  tax_number?: string
  tax_office?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  postal_code?: string
  website?: string
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
  tax_rate?: number
  invoice_prefix?: string
  fiscal_year_start?: number
}

export interface UpdateOrganizationData {
  name?: string
  slug?: string
  description?: string
  tax_number?: string
  tax_office?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  postal_code?: string
  website?: string
  currency?: 'TRY' | 'USD' | 'EUR' | 'GBP'
  tax_rate?: number
  invoice_prefix?: string
  fiscal_year_start?: number
  logo_url?: string
  settings?: Record<string, any>
}

export interface InviteMemberData {
  email: string
  role: 'admin' | 'accountant' | 'user'
  invitation_message?: string
}

export const OrganizationService = {
  // Get current user's organization
  async getCurrentOrganization(): Promise<Organization | null> {
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
      .eq('status', 'active')
      .single()

    if (memberError || !member) return null

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', member.organization_id)
      .single()

    if (error) throw error
    return data
  },

  // Get organization by ID
  async getOrganization(id: string): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Create organization
  async createOrganization(orgData: CreateOrganizationData): Promise<Organization> {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('organizations')
      .insert([{
        ...orgData,
        owner_id: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    // Create owner membership
    await supabase
      .from('organization_members')
      .insert([{
        organization_id: data.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      }])

    return data
  },

  // Update organization
  async updateOrganization(id: string, updates: UpdateOrganizationData): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete organization
  async deleteOrganization(id: string): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // Get organization members
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get member's role in organization
  async getMemberRole(organizationId: string, userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (error) return null
    return data.role
  },

  // Update member role
  async updateMemberRole(memberId: string, role: 'owner' | 'admin' | 'accountant' | 'user'): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)

    if (error) throw error
  },

  // Remove member
  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)

    if (error) throw error
  },

  // Invite member
  async inviteMember(organizationId: string, inviteData: InviteMemberData): Promise<OrganizationInvitation> {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('User not authenticated')

    // Generate a random token for the invitation
    const token = crypto.randomUUID()

    // Set expiration to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert([{
        organization_id: organizationId,
        email: inviteData.email,
        role: inviteData.role,
        invitation_message: inviteData.invitation_message,
        invited_by: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      }])
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  // Get invitations
  async getInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, email, role, token, status, expires_at, invitation_message, invited_by, created_at, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get invitation by token
  async getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .single()

    if (error) return null

    // Check if invitation is still valid
    if (data.status !== 'pending' || data.expires_at < new Date().toISOString()) {
      await supabase
        .from('organization_invitations')
        .update({ status: 'expired' })
        .eq('token', token)
      return null
    }

    return data
  },

  // Accept invitation
  async acceptInvitation(token: string): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user
    if (!user) throw new Error('User not authenticated')

    // Direct query with conditions to avoid stack depth issues
    const { data: invitation, error: invitationError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (invitationError || !invitation) throw new Error('Invalid or expired invitation')

    // Update invitation status
    await supabase
      .from('organization_invitations')
      .update({
        status: 'accepted',
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    // Create organization membership
    await supabase
      .from('organization_members')
      .insert([{
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
        status: 'active',
        invited_by: invitation.invited_by,
        invited_at: invitation.created_at,
      }])
  },

  // Decline invitation
  async declineInvitation(token: string): Promise<void> {
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'declined' })
      .eq('token', token)

    if (error) throw error
  },

  // Cancel invitation
  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_invitations')
      .update({ status: 'canceled' })
      .eq('id', invitationId)

    if (error) throw error
  },
}
