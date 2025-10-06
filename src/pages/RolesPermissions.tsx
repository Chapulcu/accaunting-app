import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Shield, Plus, X, Edit2, Trash2, Users, CheckCircle } from 'lucide-react'
import { RBACService } from '@/services/rbacService'
import type { RoleWithPermissions, Permission } from '@/services/rbacService'
import Tooltip from '@/components/Tooltip'

export default function RolesPermissions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    selectedPermissions: [] as string[],
  })

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      return await RBACService.getUserRoles(user.id)
    },
    enabled: !!user,
  })

  // Fetch all permissions
  const { data: permissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      return await RBACService.getAllPermissions()
    },
  })

  // Create default roles mutation
  const createDefaultMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      await RBACService.createDefaultRoles(user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Varsayılan roller oluşturuldu')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Roller oluşturulamadı')
    },
  })

  // Save role mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')

      if (selectedRole) {
        await RBACService.updateRole(
          selectedRole.id,
          user.id,
          formData.name,
          formData.description,
          formData.selectedPermissions
        )
      } else {
        await RBACService.createRole(
          user.id,
          formData.name,
          formData.description,
          formData.selectedPermissions
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success(selectedRole ? 'Rol güncellendi' : 'Rol oluşturuldu')
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'İşlem başarısız')
    },
  })

  // Delete role mutation
  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      if (!user) throw new Error('User not authenticated')
      await RBACService.deleteRole(roleId, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Rol silindi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Silme başarısız')
    },
  })

  const handleOpenModal = (role?: RoleWithPermissions) => {
    if (role) {
      setSelectedRole(role)
      setFormData({
        name: role.name,
        description: role.description || '',
        selectedPermissions: role.permissions.map((p) => p.id),
      })
    } else {
      setSelectedRole(null)
      setFormData({
        name: '',
        description: '',
        selectedPermissions: [],
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedRole(null)
  }

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedPermissions: prev.selectedPermissions.includes(permissionId)
        ? prev.selectedPermissions.filter((id) => id !== permissionId)
        : [...prev.selectedPermissions, permissionId],
    }))
  }

  // Group permissions by resource
  const groupedPermissions = permissions?.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = []
    }
    acc[permission.resource].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  const resourceLabels: Record<string, string> = {
    invoices: 'Faturalar',
    expenses: 'Giderler',
    payments: 'Ödemeler',
    reports: 'Raporlar',
    settings: 'Ayarlar',
    users: 'Kullanıcılar',
  }

  const actionLabels: Record<string, string> = {
    create: 'Oluştur',
    read: 'Görüntüle',
    update: 'Düzenle',
    delete: 'Sil',
    approve: 'Onayla',
    export: 'Dışa Aktar',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Roller ve İzinler
            </h1>
            <Tooltip content="Kullanıcı rollerini tanımlayın ve izinleri yönetin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Rol bazlı yetkilendirme ayarları
          </p>
        </div>
        <div className="flex gap-3">
          {(!roles || roles.length === 0) && (
            <button
              onClick={() => createDefaultMutation.mutate()}
              disabled={createDefaultMutation.isPending}
              className="btn-secondary flex items-center gap-2"
            >
              <Users className="w-5 h-5" />
              {createDefaultMutation.isPending ? 'Oluşturuluyor...' : 'Varsayılan Roller'}
            </button>
          )}
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Yeni Rol
          </button>
        </div>
      </div>

      {/* Roles List */}
      {rolesLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : roles && roles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <div key={role.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary-500" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{role.name}</h3>
                    {role.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {role.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">İzinler:</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 5).map((perm) => (
                    <span
                      key={perm.id}
                      className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs"
                    >
                      {resourceLabels[perm.resource]}: {actionLabels[perm.action]}
                    </span>
                  ))}
                  {role.permissions.length > 5 && (
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                      +{role.permissions.length - 5} daha
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                <button
                  onClick={() => handleOpenModal(role)}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Düzenle
                </button>
                {!role.is_system && (
                  <button
                    onClick={() => deleteMutation.mutate(role.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Henüz rol tanımlanmamış</p>
          <button
            onClick={() => createDefaultMutation.mutate()}
            className="btn-primary mx-auto"
          >
            Varsayılan Rolleri Oluştur
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-4xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedRole ? 'Rol Düzenle' : 'Yeni Rol'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rol Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Örn: Muhasebe Sorumlusu"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Açıklama
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    placeholder="Rolün açıklaması"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  İzinler
                </h3>
                <div className="space-y-4">
                  {groupedPermissions &&
                    Object.entries(groupedPermissions).map(([resource, perms]) => (
                      <div key={resource} className="card bg-gray-50 dark:bg-slate-800">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                          {resourceLabels[resource] || resource}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          {perms.map((perm) => (
                            <label
                              key={perm.id}
                              className="flex items-center gap-2 cursor-pointer group"
                            >
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={formData.selectedPermissions.includes(perm.id)}
                                  onChange={() => togglePermission(perm.id)}
                                  className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                                />
                                {formData.selectedPermissions.includes(perm.id) && (
                                  <CheckCircle className="w-5 h-5 text-primary-600 absolute top-0 left-0 pointer-events-none" />
                                )}
                              </div>
                              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                {actionLabels[perm.action]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
