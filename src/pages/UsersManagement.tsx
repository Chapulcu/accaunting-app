import { useState, type ReactElement } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Users, Edit2, X, Shield, Mail, Calendar, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Tooltip from '@/components/Tooltip'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'accountant' | 'manager' | 'admin'
  company_name: string | null
  created_at: string
  updated_at: string
}

export default function UsersManagement() {
  const { user, userRole } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('')

  // Fetch all users (only admins can see this)
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Profile[]
    },
    enabled: userRole === 'admin',
  })

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Kullanıcı rolü güncellendi')
      handleCloseModal()
    },
    onError: (error: any) => {
      console.error('Update role error:', error)
      toast.error(error.message || 'Rol güncellenemedi')
    },
  })

  const handleOpenModal = (user: Profile) => {
    setSelectedUser(user)
    setSelectedRole(user.role)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedUser(null)
    setSelectedRole('')
  }

  const handleUpdateRole = () => {
    if (!selectedUser || !selectedRole) return

    if (selectedUser.id === user?.id && selectedRole !== 'admin') {
      toast.error('Kendi admin rolünüzü kaldıramazsınız!')
      return
    }

    updateRoleMutation.mutate({
      userId: selectedUser.id,
      newRole: selectedRole,
    })
  }

  const roleLabels: Record<string, string> = {
    admin: 'Yönetici',
    manager: 'Müdür',
    accountant: 'Muhasebeci',
    user: 'Kullanıcı',
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    manager: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    accountant: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  }

  const roleIcons: Record<string, ReactElement> = {
    admin: <Shield className="w-4 h-4" />,
    manager: <Users className="w-4 h-4" />,
    accountant: <CheckCircle className="w-4 h-4" />,
    user: <XCircle className="w-4 h-4" />,
  }

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Yetkisiz Erişim
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Bu sayfayı görüntüleme yetkiniz yok.
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
              Kullanıcı Yönetimi
            </h1>
            <Tooltip content="Sisteme kayıtlı kullanıcıları görüntüleyin ve yönetin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kullanıcıları görüntüleyin ve rollerini düzenleyin
          </p>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Toplam {users?.length || 0} kullanıcı
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : users && users.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kullanıcı
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Şirket
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Kayıt Tarihi
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {users.map((userItem) => (
                  <tr
                    key={userItem.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
                          {userItem.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {userItem.full_name || 'İsimsiz'}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Mail className="w-3 h-3" />
                            {userItem.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                          roleColors[userItem.role]
                        }`}
                      >
                        {roleIcons[userItem.role]}
                        {roleLabels[userItem.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {userItem.company_name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(userItem.created_at).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenModal(userItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Düzenle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Henüz kullanıcı yok</p>
        </div>
      )}

      {/* Edit Role Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Rol Düzenle
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* User Info */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-lg">
                    {selectedUser.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {selectedUser.full_name || 'İsimsiz'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedUser.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Kullanıcı Rolü
                </label>
                <div className="space-y-2">
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <label
                      key={role}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedRole === role
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role}
                        checked={selectedRole === role}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <span className={`p-2 rounded-lg ${roleColors[role]}`}>
                          {roleIcons[role]}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {role === 'admin' && 'Tüm yetkilere sahip'}
                            {role === 'manager' && 'Yönetim yetkileri'}
                            {role === 'accountant' && 'Muhasebe işlemleri'}
                            {role === 'user' && 'Temel kullanıcı yetkileri'}
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedUser.id === user?.id && selectedRole !== 'admin' && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ Kendi admin rolünüzü kaldıramazsınız!
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={updateRoleMutation.isPending || !selectedRole}
                  className="btn-primary flex-1"
                >
                  {updateRoleMutation.isPending ? 'Güncelleniyor...' : 'Güncelle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
