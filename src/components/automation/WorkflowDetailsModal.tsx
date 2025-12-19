import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { X, Clock, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface WorkflowDetailsModalProps {
  workflow: {
    id: string
    workflow_name: string
    workflow_type: string
    trigger_type: string
    webhook_url?: string
    schedule_cron?: string
    is_active: boolean
    total_executions: number
    successful_executions: number
    failed_executions: number
    last_execution_at?: string
    last_execution_status?: string
    description?: string
    created_at: string
  }
  onClose: () => void
}

export default function WorkflowDetailsModal({ workflow, onClose }: WorkflowDetailsModalProps) {
  // Fetch execution logs
  const { data: logs } = useQuery({
    queryKey: ['workflow-logs', workflow.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_event_logs')
        .select('*')
        .eq('workflow_config_id', workflow.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return data
    },
  })

  const successRate =
    workflow.total_executions > 0
      ? Math.round((workflow.successful_executions / workflow.total_executions) * 100)
      : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {workflow.workflow_name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  workflow.is_active
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {workflow.is_active ? 'Aktif' : 'Pasif'}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {workflow.workflow_type} · {workflow.trigger_type}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        {workflow.description && (
          <div className="mb-6">
            <p className="text-gray-600 dark:text-gray-400">{workflow.description}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Toplam</div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {workflow.total_executions}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <div className="text-sm text-green-700 dark:text-green-300">Başarılı</div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {workflow.successful_executions}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div>
                <div className="text-sm text-red-700 dark:text-red-300">Başarısız</div>
                <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {workflow.failed_executions}
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              <div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Başarı Oranı</div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {successRate}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Konfigürasyon
          </h3>
          <div className="space-y-3">
            {workflow.webhook_url && (
              <div className="flex items-start gap-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                  Webhook URL:
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 flex-1 font-mono break-all">
                  {workflow.webhook_url}
                </div>
              </div>
            )}
            {workflow.schedule_cron && (
              <div className="flex items-start gap-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                  Cron İfadesi:
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 flex-1 font-mono">
                  {workflow.schedule_cron}
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                Oluşturulma:
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                {format(new Date(workflow.created_at), 'dd MMMM yyyy HH:mm', { locale: tr })}
              </div>
            </div>
            {workflow.last_execution_at && (
              <div className="flex items-start gap-3">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32">
                  Son Çalışma:
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                  {format(new Date(workflow.last_execution_at), 'dd MMMM yyyy HH:mm', {
                    locale: tr,
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Execution Logs */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Son Çalışmalar
          </h3>

          {logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {log.status === 'sent' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {log.event_type}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          log.status === 'sent'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(log.created_at), 'HH:mm:ss', { locale: tr })}
                    </span>
                  </div>
                  {log.error_message && (
                    <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {log.error_message}
                    </div>
                  )}
                  {log.response_code && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      HTTP {log.response_code}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Henüz çalışma kaydı yok
            </div>
          )}
        </div>

        {/* Close Button */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
          <button onClick={onClose} className="btn-primary w-full">
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
