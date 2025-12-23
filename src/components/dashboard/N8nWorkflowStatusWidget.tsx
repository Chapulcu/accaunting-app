import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/contexts/AuthContext'
import { Workflow, CheckCircle2, XCircle, Clock, Loader2, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

interface WorkflowStats {
  total: number
  active: number
  inactive: number
  failed_last_24h: number
}

export default function N8nWorkflowStatusWidget() {
  const { settings } = useSettings()
  const { user } = useAuth()

  const { data: stats, isLoading } = useQuery<WorkflowStats>({
    queryKey: ['n8n-workflow-stats'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      // Get all workflows
      const { data: workflows, error: workflowsError } = await supabase
        .from('n8n_workflows')
        .select('id, workflow_name, is_active, created_at')
        .eq('user_id', user.id)

      if (workflowsError) throw workflowsError

      const total = workflows?.length || 0
      const active = workflows?.filter((w) => w.is_active).length || 0
      const inactive = total - active

      // Get failed executions in last 24 hours
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: failedExecutions, error: executionsError } = await supabase
        .from('n8n_workflow_executions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'failed')
        .gte('created_at', twentyFourHoursAgo.toISOString())

      if (executionsError) throw executionsError

      const failed_last_24h = failedExecutions?.length || 0

      return {
        total,
        active,
        inactive,
        failed_last_24h,
      }
    },
    enabled: !!settings?.n8n_enabled && !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  // Don't show if feature is disabled
  if (!settings?.n8n_enabled) {
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-purple-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            n8n Otomasyon Durumu
          </h2>
        </div>
        <Link
          to="/automation/n8n-workflows"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Tümünü Gör
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      )}

      {stats && !isLoading && (
        <div className="space-y-4">
          {/* Total Workflows */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Workflow className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Toplam Workflow
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Active */}
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                  Aktif
                </p>
              </div>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {stats.active}
              </p>
            </div>

            {/* Inactive */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                  Pasif
                </p>
              </div>
              <p className="text-xl font-bold text-gray-600 dark:text-gray-400">
                {stats.inactive}
              </p>
            </div>

            {/* Failed (24h) */}
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                  Hatalı (24s)
                </p>
              </div>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {stats.failed_last_24h}
              </p>
            </div>
          </div>

          {/* Quick Action */}
          <Link
            to="/automation/n8n-workflows"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            <span className="font-medium">Workflow Yönet</span>
          </Link>
        </div>
      )}

      {stats && stats.total === 0 && !isLoading && (
        <div className="text-center py-8">
          <Workflow className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Henüz workflow oluşturmadınız
          </p>
          <Link
            to="/automation/n8n-workflows"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            İlk Workflow'u Oluştur
          </Link>
        </div>
      )}
    </div>
  )
}
