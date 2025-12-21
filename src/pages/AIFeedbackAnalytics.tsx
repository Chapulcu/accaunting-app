import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  AlertCircle,
  Download,
  CheckCircle2,
  XCircle,
  BarChart3,
  PieChart,
  Users,
  Calendar,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import toast from 'react-hot-toast'
import Tooltip as TooltipComponent from '@/components/Tooltip'

interface FeedbackMetrics {
  total_scans: number
  approved_count: number
  rejected_count: number
  pending_count: number
  approval_rate: number
  avg_confidence_approved: number
  avg_confidence_rejected: number
  total_amount_processed: number
}

interface VendorAccuracy {
  vendor_name: string
  total_scans: number
  approved: number
  rejected: number
  accuracy_rate: number
  avg_confidence: number
}

interface CategoryAccuracy {
  category_name: string
  total_suggestions: number
  approved: number
  rejected: number
  accuracy_rate: number
}

interface TrendData {
  date: string
  approved: number
  rejected: number
  avg_confidence: number
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6']

export default function AIFeedbackAnalytics() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const queryClient = useQueryClient()

  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')
  const [bulkActionType, setBulkActionType] = useState<'approve-high' | 'reject-low' | null>(null)

  // Fetch feedback metrics
  const { data: metrics } = useQuery<FeedbackMetrics>({
    queryKey: ['ai-feedback-metrics', dateRange],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('ai_training_data')
        .select('confidence_score, user_feedback, ai_suggestion')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')

      // Apply date range filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange)
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      const items = data || []
      const total_scans = items.length
      const approved_count = items.filter((i) => i.user_feedback === 'approved').length
      const rejected_count = items.filter((i) => i.user_feedback === 'rejected').length
      const pending_count = items.filter((i) => !i.user_feedback).length
      const approval_rate = total_scans > 0 ? (approved_count / total_scans) * 100 : 0

      const approvedItems = items.filter((i) => i.user_feedback === 'approved')
      const rejectedItems = items.filter((i) => i.user_feedback === 'rejected')

      const avg_confidence_approved =
        approvedItems.reduce((sum, i) => sum + (i.confidence_score || 0), 0) /
        (approvedItems.length || 1)

      const avg_confidence_rejected =
        rejectedItems.reduce((sum, i) => sum + (i.confidence_score || 0), 0) /
        (rejectedItems.length || 1)

      // Calculate total amount processed
      const total_amount_processed = items.reduce((sum, i) => {
        try {
          const suggestion = JSON.parse(i.ai_suggestion || '{}')
          return sum + (suggestion.total_amount || 0)
        } catch (e) {
          return sum
        }
      }, 0)

      return {
        total_scans,
        approved_count,
        rejected_count,
        pending_count,
        approval_rate,
        avg_confidence_approved,
        avg_confidence_rejected,
        total_amount_processed,
      }
    },
    enabled: !!user && !!settings?.ai_ocr_enabled,
  })

  // Fetch vendor accuracy
  const { data: vendorAccuracy } = useQuery<VendorAccuracy[]>({
    queryKey: ['vendor-accuracy', dateRange],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('ai_training_data')
        .select('ai_suggestion, user_feedback, confidence_score')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .not('user_feedback', 'is', null)

      if (dateRange !== 'all') {
        const days = parseInt(dateRange)
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Group by vendor
      const vendorMap = new Map<string, any>()

      data?.forEach((item) => {
        try {
          const suggestion = JSON.parse(item.ai_suggestion || '{}')
          const vendorName = suggestion.vendor_name || 'Unknown'

          if (!vendorMap.has(vendorName)) {
            vendorMap.set(vendorName, {
              vendor_name: vendorName,
              total_scans: 0,
              approved: 0,
              rejected: 0,
              confidence_sum: 0,
            })
          }

          const vendor = vendorMap.get(vendorName)
          vendor.total_scans++
          vendor.confidence_sum += item.confidence_score || 0

          if (item.user_feedback === 'approved') vendor.approved++
          if (item.user_feedback === 'rejected') vendor.rejected++
        } catch (e) {
          // Skip invalid JSON
        }
      })

      return Array.from(vendorMap.values())
        .map((v) => ({
          ...v,
          accuracy_rate: v.total_scans > 0 ? (v.approved / v.total_scans) * 100 : 0,
          avg_confidence: v.confidence_sum / v.total_scans,
        }))
        .sort((a, b) => b.total_scans - a.total_scans)
        .slice(0, 10)
    },
    enabled: !!user && !!settings?.ai_ocr_enabled,
  })

  // Fetch trend data
  const { data: trendData } = useQuery<TrendData[]>({
    queryKey: ['feedback-trend', dateRange],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('ai_training_data')
        .select('created_at, user_feedback, confidence_score')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .order('created_at', { ascending: true })

      if (dateRange !== 'all') {
        const days = parseInt(dateRange)
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Group by date
      const dateMap = new Map<string, any>()

      data?.forEach((item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0]

        if (!dateMap.has(date)) {
          dateMap.set(date, {
            date,
            approved: 0,
            rejected: 0,
            confidence_sum: 0,
            count: 0,
          })
        }

        const day = dateMap.get(date)
        day.count++
        day.confidence_sum += item.confidence_score || 0

        if (item.user_feedback === 'approved') day.approved++
        if (item.user_feedback === 'rejected') day.rejected++
      })

      return Array.from(dateMap.values()).map((d) => ({
        ...d,
        avg_confidence: d.count > 0 ? d.confidence_sum / d.count : 0,
      }))
    },
    enabled: !!user && !!settings?.ai_ocr_enabled,
  })

  // Bulk approve high confidence
  const bulkApproveMutation = useMutation({
    mutationFn: async (minConfidence: number) => {
      if (!user) throw new Error('User not authenticated')

      const { data: items } = await supabase
        .from('ai_training_data')
        .select('id')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .is('user_feedback', null)
        .gte('confidence_score', minConfidence)

      if (!items || items.length === 0) {
        throw new Error('Uygun kayıt bulunamadı')
      }

      const { error } = await supabase
        .from('ai_training_data')
        .update({ user_feedback: 'approved' })
        .in('id', items.map((i) => i.id))

      if (error) throw error

      return items.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['ai-feedback-metrics'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-accuracy'] })
      queryClient.invalidateQueries({ queryKey: ['feedback-trend'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-history'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-stats'] })
      toast.success(`${count} tarama otomatik onaylandı`)
      setBulkActionType(null)
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'İşlem başarısız'}`)
    },
  })

  // Bulk reject low confidence
  const bulkRejectMutation = useMutation({
    mutationFn: async (maxConfidence: number) => {
      if (!user) throw new Error('User not authenticated')

      const { data: items } = await supabase
        .from('ai_training_data')
        .select('id')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .is('user_feedback', null)
        .lte('confidence_score', maxConfidence)

      if (!items || items.length === 0) {
        throw new Error('Uygun kayıt bulunamadı')
      }

      const { error } = await supabase
        .from('ai_training_data')
        .update({ user_feedback: 'rejected' })
        .in('id', items.map((i) => i.id))

      if (error) throw error

      return items.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['ai-feedback-metrics'] })
      queryClient.invalidateQueries({ queryKey: ['vendor-accuracy'] })
      queryClient.invalidateQueries({ queryKey: ['feedback-trend'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-history'] })
      queryClient.invalidateQueries({ queryKey: ['ocr-stats'] })
      toast.success(`${count} tarama otomatik reddedildi`)
      setBulkActionType(null)
    },
    onError: (error) => {
      toast.error(`Hata: ${error instanceof Error ? error.message : 'İşlem başarısız'}`)
    },
  })

  // Export feedback data
  const handleExportFeedback = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('ai_training_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .not('user_feedback', 'is', null)

      if (error) throw error

      // Convert to CSV
      const headers = ['ID', 'Entity Type', 'Confidence Score', 'User Feedback', 'AI Suggestion', 'Created At']
      const rows = data.map((item) => [
        item.id,
        item.entity_type,
        item.confidence_score,
        item.user_feedback,
        item.ai_suggestion,
        item.created_at,
      ])

      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')

      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-feedback-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success('Feedback verisi indirildi')
    } catch (error) {
      toast.error('Export hatası')
    }
  }

  if (!settings?.ai_ocr_enabled) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          AI Özellikleri Devre Dışı
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Bu özelliği kullanmak için Ayarlar'dan AI özelliklerini etkinleştirin.
        </p>
      </div>
    )
  }

  const pieData = [
    { name: 'Onaylanan', value: metrics?.approved_count || 0, color: '#10b981' },
    { name: 'Reddedilen', value: metrics?.rejected_count || 0, color: '#ef4444' },
    { name: 'Bekleyen', value: metrics?.pending_count || 0, color: '#f59e0b' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              AI Öğrenme Analitiği
            </h1>
            <TooltipComponent content="AI OCR taramalarınızın doğruluk oranı, geri bildirim istatistikleri ve model performans metrikleri." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            OCR ve AI önerilerinin performans analizi
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="input-field"
          >
            <option value="7d">Son 7 Gün</option>
            <option value="30d">Son 30 Gün</option>
            <option value="90d">Son 90 Gün</option>
            <option value="all">Tüm Zamanlar</option>
          </select>

          <button onClick={handleExportFeedback} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Onay Oranı</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {metrics.approval_rate.toFixed(1)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              {metrics.approval_rate >= 80 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {metrics.approved_count} / {metrics.total_scans} onaylandı
              </span>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ort. Güven (Onaylı)</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {(metrics.avg_confidence_approved * 100).toFixed(0)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ort. Güven (Reddedildi)</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {(metrics.avg_confidence_rejected * 100).toFixed(0)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">İşlenen Tutar</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₺{metrics.total_amount_processed.toLocaleString('tr-TR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feedback Distribution */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Geri Bildirim Dağılımı
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>

        {/* Trend Chart */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Geri Bildirim Trendi
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData || []}>
              <defs>
                <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getDate()}/${date.getMonth() + 1}`
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(label) => new Date(label).toLocaleDateString('tr-TR')}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="approved"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorApproved)"
                name="Onaylanan"
              />
              <Area
                type="monotone"
                dataKey="rejected"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorRejected)"
                name="Reddedilen"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Vendor Accuracy Table */}
      {vendorAccuracy && vendorAccuracy.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Satıcı Bazlı Doğruluk
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Satıcı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Toplam Tarama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Doğruluk Oranı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Ort. Güven
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {vendorAccuracy.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-4">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {vendor.vendor_name}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {vendor.total_scans}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${vendor.accuracy_rate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {vendor.accuracy_rate.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {(vendor.avg_confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Toplu İşlemler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Yüksek Güvenli Taramaları Onayla
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  %90 ve üzeri güven skoruna sahip bekleyen taramaları otomatik onayla
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Yüksek güvenli taramaları onaylamak istediğinizden emin misiniz?')) {
                      bulkApproveMutation.mutate(0.9)
                    }
                  }}
                  disabled={bulkApproveMutation.isPending}
                  className="btn-primary btn-sm"
                >
                  {bulkApproveMutation.isPending ? 'İşleniyor...' : 'Toplu Onayla'}
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Düşük Güvenli Taramaları Reddet
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  %50 ve altı güven skoruna sahip bekleyen taramaları otomatik reddet
                </p>
                <button
                  onClick={() => {
                    if (window.confirm('Düşük güvenli taramaları reddetmek istediğinizden emin misiniz?')) {
                      bulkRejectMutation.mutate(0.5)
                    }
                  }}
                  disabled={bulkRejectMutation.isPending}
                  className="btn-secondary btn-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                >
                  {bulkRejectMutation.isPending ? 'İşleniyor...' : 'Toplu Reddet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
