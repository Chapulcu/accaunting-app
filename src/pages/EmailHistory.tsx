import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Mail, CheckCircle, XCircle, Clock, Calendar, FileText } from 'lucide-react'

interface EmailHistory {
  id: number
  invoice_id: number | null
  recipient_email: string
  recipient_name: string | null
  subject: string
  status: 'sent' | 'failed' | 'pending'
  error_message: string | null
  sent_at: string
  invoices?: {
    invoice_number: string
  } | null
}

export default function EmailHistory() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed' | 'pending'>('all')

  // Fetch email history
  const { data: emails, isLoading } = useQuery({
    queryKey: ['email-history', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('email_history')
        .select('*, invoices(invoice_number)')
        .order('sent_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as EmailHistory[]
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            Gönderildi
          </span>
        )
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            Başarısız
          </span>
        )
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
            <Clock className="w-4 h-4" />
            Bekliyor
          </span>
        )
      default:
        return null
    }
  }

  const stats = {
    total: emails?.length || 0,
    sent: emails?.filter((e) => e.status === 'sent').length || 0,
    failed: emails?.filter((e) => e.status === 'failed').length || 0,
    pending: emails?.filter((e) => e.status === 'pending').length || 0,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Email Geçmişi</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Gönderilen tüm emailler ve durumları
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Gönderildi</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {stats.sent}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Başarısız</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {stats.failed}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Bekliyor</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                {stats.pending}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'sent'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            Gönderildi
          </button>
          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'failed'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            Başarısız
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              statusFilter === 'pending'
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            Bekliyor
          </button>
        </div>
      </div>

      {/* Email List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  Tarih
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  Alıcı
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  Konu
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  Fatura
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody>
              {emails && emails.length > 0 ? (
                emails.map((email) => (
                  <tr
                    key={email.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(email.sent_at).toLocaleString('tr-TR')}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {email.recipient_name || email.recipient_email}
                        </p>
                        {email.recipient_name && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {email.recipient_email}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-900 dark:text-white">{email.subject}</span>
                    </td>
                    <td className="py-4 px-4">
                      {email.invoices?.invoice_number ? (
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <FileText className="w-4 h-4" />
                          {email.invoices.invoice_number}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">{getStatusBadge(email.status)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Henüz email gönderilmemiş
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
