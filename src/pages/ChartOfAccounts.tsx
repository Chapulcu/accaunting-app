import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import type { Database } from '@/types/database'
import { getErrorMessage } from '@/utils/error'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  ChevronRight,
  Download,
  Upload,
} from 'lucide-react'

interface Account {
  id: string
  code: string
  name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_id: string | null
  description: string | null
  is_active: boolean
  created_at: string
}

const accountTypeLabels = {
  asset: 'Varlık',
  liability: 'Borç',
  equity: 'Özkaynak',
  revenue: 'Gelir',
  expense: 'Gider',
}

const accountTypeIcons = {
  asset: TrendingUp,
  liability: TrendingDown,
  equity: Building2,
  revenue: DollarSign,
  expense: FileText,
}

type ChartOfAccountInsert = Database['public']['Tables']['chart_of_accounts']['Insert']
type ChartOfAccountUpdate = Database['public']['Tables']['chart_of_accounts']['Update']

export default function ChartOfAccounts() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'asset' as Account['account_type'],
    parent_id: '',
    description: '',
    is_active: true,
  })

  // Fetch accounts
  const { data: accounts, isLoading } = useQuery({
    queryKey: ['chart-of-accounts', searchTerm, selectedType],
    queryFn: async () => {
      let query = supabase
        .from('chart_of_accounts')
        .select('*')
        .order('code', { ascending: true })

      if (searchTerm) {
        query = query.or(`code.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      }

      if (selectedType !== 'all') {
        query = query.eq('account_type', selectedType)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Account[]
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const baseData: ChartOfAccountUpdate = {
        code: data.code,
        name: data.name,
        account_type: data.account_type,
        parent_id: data.parent_id ? data.parent_id : null,
        description: data.description ? data.description : null,
        is_active: data.is_active,
      }

      if (editingAccount) {
        const { error } = await supabase
          .from('chart_of_accounts')
          .update(baseData)
          .eq('id', editingAccount.id)
        if (error) throw error
      } else {
        if (!user) throw new Error('User not authenticated')
        const insertPayload: ChartOfAccountInsert = {
          ...baseData,
          user_id: user.id,
        }
        const { error } = await supabase
          .from('chart_of_accounts')
          .insert([insertPayload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      toast.success(editingAccount ? 'Hesap güncellendi' : 'Hesap eklendi')
      handleCloseModal()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('chart_of_accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
      toast.success('Hesap silindi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleOpenModal = (account?: Account) => {
    if (account) {
      setEditingAccount(account)
      setFormData({
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        parent_id: account.parent_id || '',
        description: account.description || '',
        is_active: account.is_active,
      })
    } else {
      setEditingAccount(null)
      setFormData({
        code: '',
        name: '',
        account_type: 'asset',
        parent_id: '',
        description: '',
        is_active: true,
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingAccount(null)
    setFormData({
      code: '',
      name: '',
      account_type: 'asset',
      parent_id: '',
      description: '',
      is_active: true,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Bu hesabı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  // Export to CSV
  const handleExport = () => {
    if (!accounts || accounts.length === 0) {
      toast.error('Dışa aktarılacak hesap bulunamadı')
      return
    }

    const headers = ['Hesap Kodu', 'Hesap Adı', 'Hesap Tipi', 'Açıklama', 'Aktif']
    const rows = accounts.map((account) => [
      account.code,
      account.name,
      accountTypeLabels[account.account_type],
      account.description || '',
      account.is_active ? 'Evet' : 'Hayır',
    ])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Hesap_Plani_${new Date().toISOString().split('T')[0]}.csv`
    link.click()

    toast.success('Hesap planı dışa aktarıldı')
  }

  // Import from CSV
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const csv = event.target?.result as string
        const lines = csv.split('\n').slice(1) // Skip header
        const accountsToImport: ChartOfAccountInsert[] = []

        for (const line of lines) {
          if (!line.trim()) continue

          const [code, name, type, description, isActive] = line.split(',').map(s => s.trim())

          // Tip eşleştirmesi
          const typeMap: Record<string, Account['account_type']> = {
            'Varlık': 'asset',
            'Borç': 'liability',
            'Özkaynak': 'equity',
            'Gelir': 'revenue',
            'Gider': 'expense',
          }

          if (code && name && type) {
            accountsToImport.push({
              user_id: user.id,
              code,
              name,
              account_type: typeMap[type] || 'asset',
              description: description || null,
              is_active: isActive === 'Evet',
              parent_id: null,
            })
          }
        }

        if (accountsToImport.length === 0) {
          toast.error('Geçerli hesap bulunamadı')
          return
        }

        const { error } = await supabase.from('chart_of_accounts').insert(accountsToImport)

        if (error) {
          toast.error('İçe aktarma başarısız: ' + error.message)
        } else {
          queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] })
          toast.success(`${accountsToImport.length} hesap başarıyla içe aktarıldı`)
        }
      } catch (error) {
        toast.error('CSV dosyası işlenemedi')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

  const getAccountsByType = () => {
    if (!accounts) return {}
    return accounts.reduce((acc, account) => {
      if (!acc[account.account_type]) {
        acc[account.account_type] = []
      }
      acc[account.account_type].push(account)
      return acc
    }, {} as Record<string, Account[]>)
  }

  const accountsByType = getAccountsByType()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hesap Planı
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Muhasebe hesaplarınızı yönetin
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
            id="csv-import"
          />
          <label htmlFor="csv-import" className="btn-secondary cursor-pointer">
            <Upload className="w-5 h-5 mr-2" />
            İçe Aktar
          </label>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            Dışa Aktar
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Yeni Hesap
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Hesap kodu veya adı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field !pl-10"
            />
          </div>
        </div>
        <div className="card">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Hesap Türleri</option>
            <option value="asset">Varlık</option>
            <option value="liability">Borç</option>
            <option value="equity">Özkaynak</option>
            <option value="revenue">Gelir</option>
            <option value="expense">Gider</option>
          </select>
        </div>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(accountsByType).map(([type, typeAccounts]) => {
            const Icon = accountTypeIcons[type as keyof typeof accountTypeIcons]
            return (
              <div key={type} className="card">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
                  <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {accountTypeLabels[type as keyof typeof accountTypeLabels]}
                  </h2>
                  <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {typeAccounts.length} hesap
                  </span>
                </div>
                <div className="space-y-2">
                  {typeAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400">
                              {account.code}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {account.name}
                            </span>
                            {!account.is_active && (
                              <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                Pasif
                              </span>
                            )}
                          </div>
                          {account.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {account.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(account)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {typeAccounts.length === 0 && (
                    <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Bu türde hesap bulunmuyor
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {accounts?.length === 0 && (
            <div className="card text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                Henüz hesap bulunmuyor
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingAccount ? 'Hesap Düzenle' : 'Yeni Hesap'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hesap Kodu *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="input-field"
                    placeholder="Örn: 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Hesap Türü *
                  </label>
                  <select
                    value={formData.account_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        account_type: e.target.value as Account['account_type'],
                      })
                    }
                    className="input-field"
                  >
                    <option value="asset">Varlık</option>
                    <option value="liability">Borç</option>
                    <option value="equity">Özkaynak</option>
                    <option value="revenue">Gelir</option>
                    <option value="expense">Gider</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hesap Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input-field"
                  placeholder="Örn: Kasa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Üst Hesap
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) =>
                    setFormData({ ...formData, parent_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">Üst hesap yok</option>
                  {accounts
                    ?.filter((a) => a.id !== editingAccount?.id)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input-field"
                  rows={3}
                  placeholder="Hesap açıklaması..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Aktif hesap
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending
                    ? 'Kaydediliyor...'
                    : editingAccount
                    ? 'Güncelle'
                    : 'Ekle'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
