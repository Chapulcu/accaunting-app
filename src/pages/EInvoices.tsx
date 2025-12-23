import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  FileText,
  Search,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  RefreshCw,
  Calendar,
  Inbox,
} from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import { EInvoiceService } from '@/services/eInvoiceService'

interface EInvoice {
  id: string
  e_invoice_uuid: string | null
  invoice_number: string
  status: string
  direction: 'outgoing' | 'incoming'
  issue_date: string
  total_amount: number
  currency: string
  buyer_title: string | null
  seller_title: string | null
  send_date: string | null
  response_message: string | null
}

export default function EInvoices() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')

  // Fetch e-invoices
  const { data: eInvoices, isLoading } = useQuery({
    queryKey: ['e-invoices', searchTerm, statusFilter, directionFilter],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('e_invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('issue_date', { ascending: false })

      if (searchTerm) {
        query = query.or(`invoice_number.ilike.%${searchTerm}%,buyer_title.ilike.%${searchTerm}%`)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (directionFilter !== 'all') {
        query = query.eq('direction', directionFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as EInvoice[]
    },
    enabled: !!user,
  })

  // Refresh status mutation
  const refreshStatusMutation = useMutation({
    mutationFn: async (eInvoiceUuid: string) => {
      return await EInvoiceService.refreshStatus(eInvoiceUuid)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['e-invoices'] })
      toast.success('Durum güncellendi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Durum sorgulanamadı')
    },
  })

  // Fetch incoming invoices mutation
  const fetchIncomingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      return await EInvoiceService.fetchIncomingInvoices(user.id)
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['e-invoices'] })
      if (count > 0) {
        toast.success(`${count} yeni gelen e-fatura kaydedildi`)
      } else {
        toast.success('Yeni gelen e-fatura yok')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Gelen faturalar çekilemedi')
    },
  })

  // Download XML
  const downloadXML = async (eInvoice: EInvoice) => {
    if (!eInvoice.e_invoice_uuid) {
      toast.error('E-Fatura UUID bulunamadı')
      return
    }

    // Mock download - gerçek implementasyonda provider'dan çekilir
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <UUID>${eInvoice.e_invoice_uuid}</UUID>
  <InvoiceNumber>${eInvoice.invoice_number}</InvoiceNumber>
  <IssueDate>${eInvoice.issue_date}</IssueDate>
  <TotalAmount>${eInvoice.total_amount}</TotalAmount>
</Invoice>`

    const blob = new Blob([xmlContent], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${eInvoice.invoice_number}.xml`
    link.click()
    URL.revokeObjectURL(url)

    toast.success('XML indirildi')
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      draft: {
        bg: 'bg-gray-100 dark:bg-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
        icon: Clock,
        label: 'Taslak',
      },
      sent: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        icon: Send,
        label: 'Gönderildi',
      },
      delivered: {
        bg: 'bg-purple-100 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-300',
        icon: CheckCircle,
        label: 'Teslim Edildi',
      },
      accepted: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        icon: CheckCircle,
        label: 'Kabul Edildi',
      },
      rejected: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        icon: XCircle,
        label: 'Reddedildi',
      },
      cancelled: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        icon: XCircle,
        label: 'İptal',
      },
    }

    const badge = badges[status as keyof typeof badges] || badges.draft
    const Icon = badge.icon

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    )
  }

  const stats = {
    total: eInvoices?.length || 0,
    sent: eInvoices?.filter((e) => e.status === 'sent').length || 0,
    accepted: eInvoices?.filter((e) => e.status === 'accepted').length || 0,
    rejected: eInvoices?.filter((e) => e.status === 'rejected').length || 0,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">E-Fatura Yönetimi</h1>
            <Tooltip content="Gönderilen ve alınan e-faturaları görüntüleyin, durumlarını takip edin ve XML dosyalarını indirin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            E-Fatura kayıtları ve durum takibi
          </p>
        </div>
        <button
          onClick={() => fetchIncomingMutation.mutate()}
          disabled={fetchIncomingMutation.isPending}
          className="btn-primary flex items-center gap-2"
        >
          <Inbox className="w-5 h-5" />
          {fetchIncomingMutation.isPending ? 'Çekiliyor...' : 'Gelen Faturaları Çek'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gönderildi</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {stats.sent}
              </p>
            </div>
            <Send className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Kabul</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.accepted}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Red</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.rejected}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Fatura no veya müşteri ara..."
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
            <option value="sent">Gönderildi</option>
            <option value="delivered">Teslim Edildi</option>
            <option value="accepted">Kabul Edildi</option>
            <option value="rejected">Reddedildi</option>
            <option value="cancelled">İptal</option>
          </select>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">Tümü (Giden/Gelen)</option>
            <option value="outgoing">Giden Faturalar</option>
            <option value="incoming">Gelen Faturalar</option>
          </select>
        </div>
      </div>

      {/* E-Invoices Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : eInvoices && eInvoices.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Fatura No
                  </th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Tarih
                  </th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Taraf
                  </th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Tutar
                  </th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Durum
                  </th>
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {eInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {invoice.invoice_number}
                        </p>
                        {invoice.e_invoice_uuid && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {invoice.e_invoice_uuid.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(invoice.issue_date).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-gray-900 dark:text-white">
                          {invoice.direction === 'outgoing'
                            ? invoice.buyer_title || '-'
                            : invoice.seller_title || '-'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {invoice.direction === 'outgoing' ? 'Giden' : 'Gelen'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {invoice.total_amount.toLocaleString('tr-TR', {
                          style: 'currency',
                          currency: invoice.currency || 'TRY',
                        })}
                      </p>
                    </td>
                    <td className="p-4">{getStatusBadge(invoice.status)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        {invoice.e_invoice_uuid && (
                          <>
                            <button
                              onClick={() => refreshStatusMutation.mutate(invoice.e_invoice_uuid!)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Durumu Yenile"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadXML(invoice)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="XML İndir"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </>
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
        <div className="card">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Henüz e-fatura kaydı yok</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Fatura sayfasından e-fatura gönderebilirsiniz
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
