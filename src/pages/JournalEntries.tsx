import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Trash2,
  X,
  BookOpen,
  Check,
  Calendar,
} from 'lucide-react'
import Tooltip from '@/components/Tooltip'

interface JournalEntry {
  id: number
  entry_date: string
  entry_number: string
  description: string
  reference_type: string | null
  reference_id: number | null
  status: 'draft' | 'posted' | 'cancelled'
  total_debit: number
  total_credit: number
  notes: string | null
  created_at: string
}

interface JournalEntryLine {
  id: number
  journal_entry_id: number
  account_id: string
  account_code?: string
  account_name?: string
  debit: number
  credit: number
  description: string | null
}

interface Account {
  id: string
  code: string
  name: string
  account_type: string
}

export default function JournalEntries() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [entryLines, setEntryLines] = useState<JournalEntryLine[]>([])

  // Form state
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    notes: '',
  })

  const [lines, setLines] = useState<Omit<JournalEntryLine, 'id' | 'journal_entry_id'>[]>([
    { account_id: '', debit: 0, credit: 0, description: '' },
  ])

  // Fetch journal entries
  const { data: entries, isLoading } = useQuery({
    queryKey: ['journal-entries', statusFilter, searchTerm, startDate, endDate, accountFilter],
    queryFn: async () => {
      let query = supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('entry_date', { ascending: false })
        .order('entry_number', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (searchTerm) {
        query = query.or(`entry_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }

      if (startDate) {
        query = query.gte('entry_date', startDate)
      }

      if (endDate) {
        query = query.lte('entry_date', endDate)
      }

      const { data, error } = await query
      if (error) throw error

      // Hesap filtresi için satırları kontrol et
      if (accountFilter && accountFilter !== 'all') {
        const filteredEntries = []
        for (const entry of data as JournalEntry[]) {
          const { data: lines } = await supabase
            .from('journal_entry_lines')
            .select('account_id')
            .eq('journal_entry_id', entry.id)
            .eq('account_id', accountFilter)

          if (lines && lines.length > 0) {
            filteredEntries.push(entry)
          }
        }
        return filteredEntries
      }

      return data as JournalEntry[]
    },
    enabled: !!user,
  })

  // Fetch accounts
  const { data: accounts } = useQuery({
    queryKey: ['chart-of-accounts-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('user_id', user?.id || '')
        .eq('is_active', true)
        .order('code')

      if (error) throw error
      return data as Account[]
    },
    enabled: !!user,
  })

  // Fetch entry lines for details modal
  const fetchEntryLines = async (entryId: number) => {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        *,
        chart_of_accounts:account_id (
          code,
          name
        )
      `)
      .eq('journal_entry_id', entryId)

    if (error) throw error

    return data.map((line: any) => ({
      ...line,
      account_code: line.chart_of_accounts?.code,
      account_name: line.chart_of_accounts?.name,
    })) as JournalEntryLine[]
  }

  // Create journal entry mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')

      // Validate lines
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0)

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('Borç ve alacak tutarları eşit olmalı')
      }

      if (lines.length === 0 || !lines.some(l => l.account_id)) {
        throw new Error('En az bir hesap satırı eklemelisiniz')
      }

      // Generate entry number
      const { data: lastEntry } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .eq('user_id', user.id)
        .order('entry_number', { ascending: false })
        .limit(1)
        .single()

      const lastNumber = lastEntry?.entry_number ? parseInt(lastEntry.entry_number.split('-')[1]) : 0
      const entryNumber = `YEV-${String(lastNumber + 1).padStart(6, '0')}`

      // Create entry
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          entry_date: formData.entry_date,
          entry_number: entryNumber,
          description: formData.description,
          reference_type: 'manual',
          status: 'draft',
          total_debit: totalDebit,
          total_credit: totalCredit,
          notes: formData.notes || null,
        })
        .select()
        .single()

      if (entryError) throw entryError

      // Create lines
      const linesToInsert = lines
        .filter(l => l.account_id && (l.debit > 0 || l.credit > 0))
        .map(line => ({
          journal_entry_id: entry.id,
          account_id: line.account_id,
          debit: line.debit || 0,
          credit: line.credit || 0,
          description: line.description || null,
        }))

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(linesToInsert)

      if (linesError) throw linesError

      return entry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Yevmiye kaydı oluşturuldu')
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kayıt oluşturulamadı')
    },
  })

  // Post journal entry (make it permanent)
  const postMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const { data, error } = await supabase.rpc('post_journal_entry', {
        p_journal_entry_id: entryId,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Yevmiye kaydı deftere kaydedildi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kayıt deftere işlenemedi')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Yevmiye kaydı silindi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kayıt silinemedi')
    },
  })

  const handleOpenModal = () => {
    setFormData({
      entry_date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    })
    setLines([{ account_id: '', debit: 0, credit: 0, description: '' }])
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
  }

  const handleAddLine = () => {
    setLines([...lines, { account_id: '', debit: 0, credit: 0, description: '' }])
  }

  const handleRemoveLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index))
    }
  }

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  const handleViewDetails = async (entry: JournalEntry) => {
    setSelectedEntry(entry)
    const lines = await fetchEntryLines(entry.id)
    setEntryLines(lines)
    setShowDetailsModal(true)
  }

  const handlePost = (entryId: number) => {
    if (window.confirm('Bu kaydı deftere işlemek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      postMutation.mutate(entryId)
    }
  }

  const handleDelete = (id: number, status: string) => {
    if (status !== 'draft') {
      toast.error('Sadece taslak kayıtlar silinebilir')
      return
    }
    if (window.confirm('Bu kaydı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0)
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      posted: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
      cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    }
    const labels = {
      draft: 'Taslak',
      posted: 'Defterde',
      cancelled: 'İptal',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Yevmiye Defteri
            </h1>
            <Tooltip content="Muhasebe kayıtlarınızı (yevmiye) görüntüleyin ve yönetin. Her kayıt borç ve alacak hesaplarını dengeli şekilde içermelidir." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Journal Entries - Muhasebe Kayıtları
          </p>
        </div>
        <button onClick={handleOpenModal} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Kayıt
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Kayıt numarası veya açıklama ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="posted">Defterde</option>
            <option value="cancelled">İptal</option>
          </select>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              placeholder="Başlangıç Tarihi"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              placeholder="Bitiş Tarihi"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field !pl-10"
            />
          </div>
        </div>

        {/* Account Filter - Second Row */}
        <div className="mt-4">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">Tüm Hesaplar</option>
            {accounts?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Entries Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Kayıt No</th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Tarih</th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">Açıklama</th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">Borç</th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">Alacak</th>
                  <th className="text-center p-4 font-semibold text-gray-900 dark:text-white">Durum</th>
                  <th className="text-center p-4 font-semibold text-gray-900 dark:text-white">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => handleViewDetails(entry)}
                  >
                    <td className="p-4">
                      <span className="font-mono text-sm text-primary-600 dark:text-primary-400">
                        {entry.entry_number}
                      </span>
                    </td>
                    <td className="p-4 text-gray-900 dark:text-white">
                      {new Date(entry.entry_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="p-4 text-gray-900 dark:text-white">
                      {entry.description}
                    </td>
                    <td className="p-4 text-right text-gray-900 dark:text-white">
                      ₺{entry.total_debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right text-gray-900 dark:text-white">
                      ₺{entry.total_credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {entry.status === 'draft' && (
                          <button
                            onClick={() => handlePost(entry.id)}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Deftere Kaydet"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {entry.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(entry.id, entry.status)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || statusFilter !== 'all' ? 'Arama sonucu bulunamadı' : 'Henüz yevmiye kaydı bulunmuyor'}
          </p>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Yeni Yevmiye Kaydı
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tarih *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.entry_date}
                    onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Açıklama *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field"
                    placeholder="Kayıt açıklaması"
                  />
                </div>
              </div>

              {/* Lines Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hesap Satırları *
                  </label>
                  <button type="button" onClick={handleAddLine} className="btn-secondary text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Satır Ekle
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Hesap</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Açıklama</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Borç</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Alacak</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index} className="border-t border-gray-200 dark:border-slate-700">
                          <td className="p-2">
                            <select
                              value={line.account_id}
                              onChange={(e) => handleLineChange(index, 'account_id', e.target.value)}
                              className="input-field text-sm"
                              required
                            >
                              <option value="">Hesap Seçin</option>
                              {accounts?.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={line.description || ''}
                              onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                              className="input-field text-sm"
                              placeholder="Açıklama"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.debit || ''}
                              onChange={(e) => {
                                handleLineChange(index, 'debit', parseFloat(e.target.value) || 0)
                                if (parseFloat(e.target.value) > 0) {
                                  handleLineChange(index, 'credit', 0)
                                }
                              }}
                              className="input-field text-sm text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.credit || ''}
                              onChange={(e) => {
                                handleLineChange(index, 'credit', parseFloat(e.target.value) || 0)
                                if (parseFloat(e.target.value) > 0) {
                                  handleLineChange(index, 'debit', 0)
                                }
                              }}
                              className="input-field text-sm text-right"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="p-2">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                        <td className="p-3 font-bold text-gray-900 dark:text-white" colSpan={2}>
                          TOPLAM
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                          ₺{totalDebit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                          ₺{totalCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {!isBalanced && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    ⚠️ Borç ve alacak tutarları eşit olmalı! Fark: ₺{Math.abs(totalDebit - totalCredit).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notlar
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Ek notlar..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={createMutation.isPending || !isBalanced}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Kaydediliyor...' : 'Taslak Olarak Kaydet'}
                </button>
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Yevmiye Kaydı Detayları
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedEntry.entry_number} - {new Date(selectedEntry.entry_date).toLocaleDateString('tr-TR')}
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Açıklama:</span>
                  <p className="text-gray-900 dark:text-white mt-1">{selectedEntry.description}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Durum:</span>
                  <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                </div>
              </div>

              {selectedEntry.notes && (
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Notlar:</span>
                  <p className="text-gray-900 dark:text-white mt-1">{selectedEntry.notes}</p>
                </div>
              )}

              <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden mt-4">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-slate-800">
                    <tr>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Hesap</th>
                      <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Açıklama</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Borç</th>
                      <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Alacak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryLines.map((line) => (
                      <tr key={line.id} className="border-t border-gray-200 dark:border-slate-700">
                        <td className="p-3">
                          <div className="font-mono text-sm text-primary-600 dark:text-primary-400">
                            {line.account_code}
                          </div>
                          <div className="text-sm text-gray-900 dark:text-white">{line.account_name}</div>
                        </td>
                        <td className="p-3 text-gray-900 dark:text-white">{line.description || '-'}</td>
                        <td className="p-3 text-right text-gray-900 dark:text-white">
                          {line.debit > 0 ? `₺${line.debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="p-3 text-right text-gray-900 dark:text-white">
                          {line.credit > 0 ? `₺${line.credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                      <td className="p-3 font-bold text-gray-900 dark:text-white" colSpan={2}>
                        TOPLAM
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                        ₺{selectedEntry.total_debit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                        ₺{selectedEntry.total_credit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
