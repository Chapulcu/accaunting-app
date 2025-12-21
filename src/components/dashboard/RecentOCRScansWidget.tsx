import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { ScanLine, CheckCircle2, AlertCircle, Loader2, FileText } from 'lucide-react'

interface OCRScan {
  id: string
  entity_type: string
  feature_type: string
  confidence_score: number | null
  ai_suggestion: string | null
  user_feedback: string | null
  created_at: string
}

export default function RecentOCRScansWidget() {
  const { settings } = useSettings()
  const { user } = useAuth()

  const { data: scans, isLoading } = useQuery<OCRScan[]>({
    queryKey: ['recent-ocr-scans'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('ai_training_data')
        .select('id, entity_type, feature_type, confidence_score, ai_suggestion, user_feedback, created_at')
        .eq('user_id', user.id)
        .eq('feature_type', 'ocr')
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) throw error
      return data || []
    },
    enabled: !!settings?.ai_ocr_enabled && !!settings?.openai_api_key_set && !!user,
    refetchOnWindowFocus: false,
  })

  // Don't show if feature is disabled
  if (!settings?.ai_ocr_enabled || !settings?.openai_api_key_set) {
    return null
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

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 0.8) return 'text-green-600 dark:text-green-400'
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getConfidenceBgColor = (score: number | null) => {
    if (!score) return 'bg-gray-100 dark:bg-gray-800'
    if (score >= 0.8) return 'bg-green-100 dark:bg-green-900/20'
    if (score >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/20'
    return 'bg-red-100 dark:bg-red-900/20'
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-green-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Son OCR Taramaları
          </h2>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-full">
          <FileText className="w-3 h-3 text-green-600 dark:text-green-400" />
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            {scans?.length || 0} tarama
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      )}

      {scans && scans.length > 0 && !isLoading && (
        <div className="space-y-3">
          {scans.map((scan) => {
            const confidence = scan.confidence_score
            const timeAgo = new Date(scan.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={scan.id}
                className="flex items-start justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getConfidenceBgColor(confidence)}`}>
                    <ScanLine className={`w-4 h-4 ${getConfidenceColor(confidence)}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getEntityTypeLabel(scan.entity_type)}
                      </p>
                      {scan.user_feedback === 'approved' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {scan.user_feedback === 'rejected' && (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>

                    {scan.ai_suggestion && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 truncate">
                        {JSON.parse(scan.ai_suggestion).vendor_name || 'Belge işlendi'}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {timeAgo}
                    </p>
                  </div>
                </div>

                {/* Confidence Score */}
                {confidence !== null && (
                  <div className={`px-2 py-1 rounded ${getConfidenceBgColor(confidence)}`}>
                    <p className={`text-xs font-semibold ${getConfidenceColor(confidence)}`}>
                      {(confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {scans && scans.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <ScanLine className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Henüz OCR taraması yapılmadı
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-1">
            Faturalar veya Giderler sayfasından OCR taraması başlatabilirsiniz
          </p>
        </div>
      )}
    </div>
  )
}
