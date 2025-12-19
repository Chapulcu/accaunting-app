import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Users,
  UserPlus,
  X,
  Shield,
  Mail,
  Calendar,
  Trash2,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  MailCheck,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { OrganizationService, InviteMemberData } from '@/services/organizationService'
import Tooltip from '@/components/Tooltip'

interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
}

export default function OrganizationMembers() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState<InviteMemberData>({
    email: '',
    role: 'user',
    invitation_message: '',
  })

  // Fetch current organization
  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: () => OrganizationService.getCurrentOrganization(),
  })

  // Fetch organization members with user profiles
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['organization-members', organization?.id],
    queryFn: async () => {
      if (!organization) return []
      const members = await OrganizationService.getMembers(organization.id)

      // Fetch user profiles for each member
      const membersWithProfiles = await Promise.all(
        members.map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, full_name, company_name')
            .eq('id', member.user_id)
            .single()

          return {
            ...member,
            profile: profile as Profile | null,
          }
        })
      )

      return membersWithProfiles
    },
    enabled: !!organization,
  })

  // Fetch pending invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['organization-invitations', organization?.id],
    queryFn: async () => {
      if (!organization) return []
      return OrganizationService.getInvitations(organization.id)
    },
    enabled: !!organization,
  })

  // Get current user's role
  const { data: userRole } = useQuery({
    queryKey: ['user-org-role', organization?.id, user?.id],
    queryFn: async () => {
      if (!organization || !user) return null
      return OrganizationService.getMemberRole(organization.id, user.id)
    },
    enabled: !!organization && !!user,
  })

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteMemberData) => {
      if (!organization) throw new Error('Organizasyon bulunamadı')
      return OrganizationService.inviteMember(organization.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations'] })
      toast.success('Davetiye gönderildi')
      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'user', invitation_message: '' })
    },
    onError: (error: any) => {
      console.error('Invite error:', error)
      toast.error(error.message || 'Davetiye gönderilemedi')
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      return OrganizationService.removeMember(memberId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] })
      toast.success('Üye kaldırıldı')
    },
    onError: (error: any) => {
      console.error('Remove member error:', error)
      toast.error(error.message || 'Üye kaldırılamadı')
    },
  })

  // Cancel invitation mutation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return OrganizationService.cancelInvitation(invitationId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations'] })
      toast.success('Davetiye iptal edildi')
    },
    onError: (error: any) => {
      console.error('Cancel invitation error:', error)
      toast.error(error.message || 'Davetiye iptal edilemedi')
    },
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    inviteMutation.mutate(inviteForm)
  }

  const handleRemoveMember = (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast.error('Kendinizi kaldıramazsınız!')
      return
    }

    if (confirm('Bu üyeyi kaldırmak istediğinizden emin misiniz?')) {
      removeMemberMutation.mutate(memberId)
    }
  }

  const handleCancelInvitation = (invitationId: string) => {
    if (confirm('Bu davetiyeyi iptal etmek istediğinizden emin misiniz?')) {
      cancelInvitationMutation.mutate(invitationId)
    }
  }

  const roleLabels: Record<string, string> = {
    owner: 'Sahip',
    admin: 'Yönetici',
    accountant: 'Muhasebeci',
    user: 'Kullanıcı',
  }

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    accountant: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    accepted: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    declined: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    expired: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    canceled: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  const canManageMembers = userRole === 'owner' || userRole === 'admin'

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Organizasyon Bulunamadı
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Henüz bir organizasyona üye değilsiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Organizasyon Üyeleri
            </h1>
            <Tooltip content="Organizasyonunuzdaki üyeleri görüntüleyin ve yönetin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {organization.name} - Üye ve davetiye yönetimi
          </p>
        </div>
        {canManageMembers && (
          <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Üye Davet Et
          </button>
        )}
      </div>

      {/* Members List */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Aktif Üyeler ({members?.length || 0})
        </h3>
        {membersLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : members && members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Üye
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Katılma Tarihi
                  </th>
                  {canManageMembers && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                          {member.profile?.email.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {member.profile?.full_name || 'İsimsiz'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="w-3 h-3" />
                            {member.profile?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${roleColors[member.role]}`}>
                        <Shield className="w-3 h-3" />
                        {roleLabels[member.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(member.joined_at).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    {canManageMembers && (
                      <td className="px-6 py-4 text-right">
                        {member.role !== 'owner' && member.user_id !== user?.id && (
                          <button
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Kaldır
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Henüz üye yok</p>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {canManageMembers && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Bekleyen Davetiyeler ({invitations?.filter((i) => i.status === 'pending').length || 0})
          </h3>
          {invitationsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Rol
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Gönderim Tarihi
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <MailCheck className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {invitation.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${roleColors[invitation.role]}`}>
                          {roleLabels[invitation.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusColors[invitation.status]}`}>
                          {invitation.status === 'pending' && <Clock className="w-3 h-3" />}
                          {invitation.status === 'accepted' && <CheckCircle className="w-3 h-3" />}
                          {invitation.status === 'declined' && <XCircle className="w-3 h-3" />}
                          {invitation.status === 'pending' && 'Bekliyor'}
                          {invitation.status === 'accepted' && 'Kabul Edildi'}
                          {invitation.status === 'declined' && 'Reddedildi'}
                          {invitation.status === 'expired' && 'Süresi Doldu'}
                          {invitation.status === 'canceled' && 'İptal Edildi'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(invitation.created_at).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {invitation.status === 'pending' && (
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                            İptal
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Send className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">Henüz davetiye gönderilmemiş</p>
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Üye Davet Et</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Adresi *
                </label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="input"
                  placeholder="ornek@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rol *
                </label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="user">Kullanıcı - Temel yetkiler</option>
                  <option value="accountant">Muhasebeci - Muhasebe işlemleri</option>
                  <option value="admin">Yönetici - Tam yetkiler</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Davet Mesajı (Opsiyonel)
                </label>
                <textarea
                  value={inviteForm.invitation_message}
                  onChange={(e) => setInviteForm({ ...inviteForm, invitation_message: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Organizasyonumuza hoş geldiniz..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button type="submit" disabled={inviteMutation.isPending} className="btn-primary flex-1">
                  {inviteMutation.isPending ? 'Gönderiliyor...' : 'Davetiye Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
