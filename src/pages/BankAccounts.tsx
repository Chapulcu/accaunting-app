import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Building2,
  Plus,
  Settings,
  RefreshCw,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { BankApiService } from '@/services/bankApiService'
import type { BankProvider } from '@/services/bankApiService'

interface BankAccount {
  id: number
  bank_name: string
  account_number: string
  iban: string
  currency: string
  current_balance: number
  api_enabled: boolean
  api_provider: string | null
  last_sync_date: string | null
  is_active: boolean
}

export default function BankAccounts() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    iban: '',
    currency: 'TRY' as const,
    current_balance: 0,
  })

  const [apiFormData, setApiFormData] = useState({
    provider: 'mock' as BankProvider,
    customerNumber: '',
    username: '',
    password: '',
    apiKey: '',
  })

  // Fetch bank accounts
  const { data: bankAccounts, isLoading } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as BankAccount[]
    },
    enabled: !!user,
  })

  // Create/Update bank account
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const payload = {
        ...formData,
        user_id: user.id,
      }

      if (selectedAccount) {
        const { error } = await supabase
          .from('bank_accounts')
          .update(payload)
          .eq('id', selectedAccount.id)
          .eq('user_id', user.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('bank_accounts').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success(selectedAccount ? 'Hesap güncellendi' : 'Hesap eklendi')
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'İşlem başarısız')
    },
  })

  // Save API credentials
  const saveApiMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAccount) throw new Error('Missing data')

      const { error } = await supabase.from('bank_api_credentials').upsert(
        {
          user_id: user.id,
          bank_account_id: selectedAccount.id,
          provider: apiFormData.provider,
          customer_number: apiFormData.customerNumber,
          username: apiFormData.username,
          password_encrypted: apiFormData.password, // Should be encrypted in production
          api_key: apiFormData.apiKey,
          is_active: true,
        },
        { onConflict: 'bank_account_id' }
      )

      if (error) throw error

      // Update bank account
      await supabase
        .from('bank_accounts')
        .update({
          api_enabled: true,
          api_provider: apiFormData.provider,
        })
        .eq('id', selectedAccount.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('API ayarları kaydedildi')
      handleCloseApiModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'API ayarları kaydedilemedi')
    },
  })

  // Sync bank account
  const syncMutation = useMutation({
    mutationFn: async (accountId: number) => {
      if (!user) throw new Error('User not authenticated')

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30) // Son 30 gün

      return await BankApiService.syncBankAccount(user.id, accountId, startDate, endDate)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      if (result.success) {
        toast.success(
          `${result.transactionsImported} işlem import edildi, ${result.transactionsSkipped} atlandı`
        )
      } else {
        toast.error(result.error || 'Senkronizasyon başarısız')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Senkronizasyon başarısız')
    },
  })

  // Delete account
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error('User not authenticated')

      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] })
      toast.success('Hesap silindi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Silme başarısız')
    },
  })

  const handleOpenModal = (account?: BankAccount) => {
    if (account) {
      setSelectedAccount(account)
      setFormData({
        bank_name: account.bank_name,
        account_number: account.account_number,
        iban: account.iban,
        currency: account.currency as 'TRY',
        current_balance: account.current_balance,
      })
    } else {
      setSelectedAccount(null)
      setFormData({
        bank_name: '',
        account_number: '',
        iban: '',
        currency: 'TRY',
        current_balance: 0,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedAccount(null)
  }

  const handleOpenApiModal = (account: BankAccount) => {
    setSelectedAccount(account)
    setShowApiModal(true)
  }

  const handleCloseApiModal = () => {
    setShowApiModal(false)
    setSelectedAccount(null)
    setApiFormData({
      provider: 'mock',
      customerNumber: '',
      username: '',
      password: '',
      apiKey: '',
    })
  }

  const stats = {
    total: bankAccounts?.length || 0,
    active: bankAccounts?.filter((a) => a.is_active).length || 0,
    apiEnabled: bankAccounts?.filter((a) => a.api_enabled).length || 0,
    totalBalance:
      bankAccounts?.reduce((sum, a) => sum + (a.is_active ? a.current_balance : 0), 0) || 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Banka Hesapları</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Banka hesaplarınızı yönetin ve API entegrasyonu yapın
          </p>
        </div>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Yeni Hesap
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Hesap</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Aktif</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {stats.active}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">API Aktif</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {stats.apiEnabled}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Bakiye</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            ₺{stats.totalBalance.toLocaleString('tr-TR')}
          </p>
        </div>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : bankAccounts && bankAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankAccounts.map((account) => (
            <div
              key={account.id}
              className="card hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-primary-500" />
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {account.bank_name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{account.iban}</p>
                  </div>
                </div>
                {account.api_enabled ? (
                  <span title="API Aktif">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </span>
                ) : (
                  <span title="API Pasif">
                    <XCircle className="w-5 h-5 text-gray-400" />
                  </span>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Bakiye:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {account.currency} {account.current_balance.toLocaleString('tr-TR')}
                  </span>
                </div>
                {account.last_sync_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Son Sync:</span>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {new Date(account.last_sync_date).toLocaleString('tr-TR')}
                    </span>
                  </div>
                )}
                {account.api_provider && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Provider:</span>
                    <span className="text-sm text-gray-900 dark:text-white uppercase">
                      {account.api_provider}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {account.api_enabled && (
                  <button
                    onClick={() => syncMutation.mutate(account.id)}
                    disabled={syncMutation.isPending}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sync
                  </button>
                )}
                <button
                  onClick={() => handleOpenApiModal(account)}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  API
                </button>
                <button
                  onClick={() => deleteMutation.mutate(account.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Henüz banka hesabı eklenmemiş</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedAccount ? 'Hesap Düzenle' : 'Yeni Hesap'}
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
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Banka Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="input-field"
                  placeholder="İş Bankası"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  IBAN *
                </label>
                <input
                  type="text"
                  required
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                  className="input-field"
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Para Birimi *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({ ...formData, currency: e.target.value as 'TRY' })
                    }
                    className="input-field"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Başlangıç Bakiyesi
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_balance}
                    onChange={(e) =>
                      setFormData({ ...formData, current_balance: parseFloat(e.target.value) })
                    }
                    className="input-field"
                  />
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

      {/* API Settings Modal */}
      {showApiModal && selectedAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                API Ayarları - {selectedAccount.bank_name}
              </h2>
              <button onClick={handleCloseApiModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Test için "Mock" provider'ı kullanın. Gerçek banka entegrasyonu için bankanızdan
                  API kimlik bilgilerini alın.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveApiMutation.mutate()
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider *
                </label>
                <select
                  value={apiFormData.provider}
                  onChange={(e) =>
                    setApiFormData({ ...apiFormData, provider: e.target.value as BankProvider })
                  }
                  className="input-field"
                >
                  <option value="mock">Mock (Test)</option>
                  <option value="isbank">İş Bankası</option>
                  <option value="garanti">Garanti</option>
                  <option value="yapikredi">YapıKredi</option>
                  <option value="akbank">Akbank</option>
                </select>
              </div>

              {apiFormData.provider !== 'mock' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Müşteri No
                    </label>
                    <input
                      type="text"
                      value={apiFormData.customerNumber}
                      onChange={(e) =>
                        setApiFormData({ ...apiFormData, customerNumber: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      value={apiFormData.username}
                      onChange={(e) =>
                        setApiFormData({ ...apiFormData, username: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Şifre
                    </label>
                    <input
                      type="password"
                      value={apiFormData.password}
                      onChange={(e) =>
                        setApiFormData({ ...apiFormData, password: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseApiModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saveApiMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveApiMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
