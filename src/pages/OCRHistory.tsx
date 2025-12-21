import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import {
  ScanLine,
  Calendar,
  FileText,
  Receipt,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  RotateCcw,
  Filter,
  TrendingUp,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Pagination from '@/components/Pagination'
import Tooltip from '@/components/Tooltip'

interface OCRHistoryItem {
  id: string
  entity_type: string
  feature_type: string
  confidence_score: number | null
  ai_suggestion: string | null
  user_feedback: string | null
  created_at: string
}

interface OCRStats {
  total_scans: number
  avg_confidence: number
  approved_count: number
  rejected_count: number
  invoice_count: number
  expense_count: number
}

export default function OCRHistory() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [entityFilter, setEntityFilter] = useState<'all' | 'invoice' | 'expense'>('all')
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'approved' | 'rejected' | 'pending'>('all')
  const [selectedItem, setSelectedItem] = useState<OCRHistoryItem | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Fetch OCR history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['ocr-history', entityFilter, feedbackFilter, searchTerm, currentPage],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('ai_training_data')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter)
      }

      if (feedbackFilter !== 'all') {
        if (feedbackFilter === 'pending') {
          query = query.is('user_feedback', null)
        } else {
          query = query.eq('user_feedback', feedbackFilter)
        }
      }

      if (searchTerm) {
        query = query.ilike('ai_suggestion', `%${searchTerm}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        items: (data || []) as OCRHistoryItem[],
        totalCount: count || 0,
      }
    },
    enabled: !!user && !!settings?.ai_ocr_enabled,
  })

  // Fetch statistics
  const { data: stats } = useQuery<OCRStats>({
    queryKey: ['ocr-stats'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_training_data')
        .select('entity_type, feature_type, confidence_score, user_feedback')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')

      if (error) throw error

      const items = data || []

      const total_scans = items.length
      const avg_confidence =
        items.reduce((sum, item) => sum + (item.confidence_score || 0), 0) / (total_scans || 1)
      const approved_count = items.filter((i) => i.user_feedback === 'approved').length
      const rejected_count = items.filter((i) => i.user_feedback === 'rejected').length
      const invoice_count = items.filter((i) => i.entity_type === 'invoice').length
      const expense_count = items.filter((i) => i.entity_type === 'expense').length

      return {
        total_scans,
        avg_confidence,
        approved_count,
        rejected_count,
        invoice_count,
        expense_count,
      }
    },
    enabled: !!user && !!settings?.ai_ocr_enabled,
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_training_data').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-history'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recent-ocr-scans'] })
      toast.success('Tarama kaydı silindi')
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'Silme başarısız'}`)
    },
  })

  // Update feedback mutation
  const updateFeedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('ai_training_data')
        .update({ user_feedback: feedback })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-history'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-stats'] })
      toast.success('Geri bildirim kaydedildi')
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'Güncelleme başarısız'}`)
    },
  })

  const handleDelete = (id: string) => {
    if (window.confirm('Bu tarama kaydını silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleReuse = (item: OCRHistoryItem) => {
    if (!item.ai_suggestion) {
      toast.error('OCR verisi bulunamadı')
      return
    }

    try {
      const ocrData = JSON.parse(item.ai_suggestion)

      // Store in sessionStorage for the target page to pick up
      sessionStorage.setItem('ocr_reuse_data', JSON.stringify({
        ...ocrData,
        entity_type: item.entity_type,
      }))

      // Navigate to appropriate page
      const targetPage = item.entity_type === 'invoice' ? '/invoices' : '/expenses'
      window.location.href = targetPage

      toast.success('OCR verisi yeniden kullanılacak...')
    } catch (error) {
      toast.error('OCR verisi ayrıştırılamadı')
    }
  }

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'invoice':
        return 'Fatura'
      case 'expense':
        return 'Gider'
      default:
        return 'Belge'
    }
  }

  const getEntityTypeIcon = (type: string) => {
    return type === 'invoice' ? FileText : Receipt
  }

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 0.8) return 'text-green-600 dark:text-green-400'
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getConfidenceBadge = (score: number | null) => {
    if (!score) return 'bg-gray-100 dark:bg-gray-800 text-gray-600'
    if (score >= 0.8) return 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
    if (score >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
    return 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
  }

  const totalPages = Math.ceil((historyData?.totalCount || 0) / itemsPerPage)

  if (!settings?.ai_ocr_enabled) {
    return (
      <div className="text-center py-12">
        <ScanLine className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          OCR Özelliği Devre Dışı
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Bu özelliği kullanmak için Ayarlar'dan OCR özelliğini etkinleştirin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            OCR Tarama Geçmişi
          </h1>
          <Tooltip content="Tüm OCR tarama işlemlerinizin geçmişi, sonuçları ve istatistikleri. Eski taramaları yeniden kullanabilir veya silebilirsiniz." />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Geçmiş OCR taramalarınızı görüntüleyin ve yönetin
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <ScanLine className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Toplam Tarama</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total_scans}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Ort. Güven</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {(stats.avg_confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Onaylanan</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.approved_count}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Reddedilen</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.rejected_count}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Fatura</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.invoice_count}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Gider</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.expense_count}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Satıcı, belge numarası ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-full"
              />
            </div>
          </div>

          {/* Entity Type Filter */}
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as typeof entityFilter)}
            className="input-field"
          >
            <option value="all">Tüm Belgeler</option>
            <option value="invoice">Faturalar</option>
            <option value="expense">Giderler</option>
          </select>

          {/* Feedback Filter */}
          <select
            value={feedbackFilter}
            onChange={(e) => setFeedbackFilter(e.target.value as typeof feedbackFilter)}
            className="input-field"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="approved">Onaylanan</option>
            <option value="rejected">Reddedilen</option>
            <option value="pending">Bekleyen</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        ) : historyData && historyData.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Tür
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Bilgi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Güven
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {historyData.items.map((item) => {
                    const Icon = getEntityTypeIcon(item.entity_type)
                    let ocrData: any = null
                    try {
                      ocrData = item.ai_suggestion ? JSON.parse(item.ai_suggestion) : null
                    } catch (e) {
                      // Invalid JSON
                    }

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(item.created_at).toLocaleDateString('tr-TR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-gray-500" />
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {getEntityTypeLabel(item.entity_type)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {ocrData?.vendor_name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {ocrData?.document_number || 'Belge No Yok'} •{' '}
                            {ocrData?.total_amount
                              ? `₺${Number(ocrData.total_amount).toLocaleString('tr-TR')}`
                              : 'Tutar Yok'}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${getConfidenceBadge(
                              item.confidence_score
                            )}`}
                          >
                            {item.confidence_score
                              ? `${(item.confidence_score * 100).toFixed(0)}%`
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {item.user_feedback === 'approved' && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                              <CheckCircle2 className="w-4 h-4" />
                              Onaylandı
                            </span>
                          )}
                          {item.user_feedback === 'rejected' && (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              Reddedildi
                            </span>
                          )}
                          {!item.user_feedback && (
                            <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              Bekliyor
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedItem(item)
                                setShowDetailModal(true)
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              title="Detayları Görüntüle"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReuse(item)}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                              title="Yeniden Kullan"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                              title="Sil"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <ScanLine className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Henüz OCR taraması yapılmadı</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                OCR Tarama Detayları
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="sr-only">Kapat</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tarih</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {new Date(selectedItem.created_at).toLocaleDateString('tr-TR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Belge Türü</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {getEntityTypeLabel(selectedItem.entity_type)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Güven Skoru</p>
                  <p className={`text-base font-medium ${getConfidenceColor(selectedItem.confidence_score)}`}>
                    {selectedItem.confidence_score
                      ? `${(selectedItem.confidence_score * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Durum</p>
                  <p className="text-base font-medium text-gray-900 dark:text-white">
                    {selectedItem.user_feedback === 'approved' && 'Onaylandı'}
                    {selectedItem.user_feedback === 'rejected' && 'Reddedildi'}
                    {!selectedItem.user_feedback && 'Bekliyor'}
                  </p>
                </div>
              </div>

              {/* OCR Result */}
              {selectedItem.ai_suggestion && (
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    OCR Sonucu
                  </p>
                  <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(JSON.parse(selectedItem.ai_suggestion), null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Feedback Actions */}
              {!selectedItem.user_feedback && (
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      updateFeedbackMutation.mutate({ id: selectedItem.id, feedback: 'approved' })
                      setShowDetailModal(false)
                    }}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Onayla
                  </button>
                  <button
                    onClick={() => {
                      updateFeedbackMutation.mutate({ id: selectedItem.id, feedback: 'rejected' })
                      setShowDetailModal(false)
                    }}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                  >
                    <XCircle className="w-5 h-5" />
                    Reddet
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
