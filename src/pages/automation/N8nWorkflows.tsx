import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'
import {
  Bot,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  ExternalLink,
  Clock,
  Webhook,
  Calendar,
  Activity,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import WorkflowCreateModal from '@/components/automation/WorkflowCreateModal'
import WorkflowDetailsModal from '@/components/automation/WorkflowDetailsModal'

interface N8nWorkflow {
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

const workflowTypeLabels: Record<string, { label: string; color: string; icon: any }> = {
  approval: { label: 'Onay Süreci', color: 'blue', icon: CheckCircle2 },
  reminder: { label: 'Hatırlatma', color: 'orange', icon: Clock },
  recurring: { label: 'Tekrarlayan', color: 'purple', icon: Calendar },
  sync: { label: 'Senkronizasyon', color: 'green', icon: Activity },
  'e-invoice': { label: 'E-Fatura', color: 'indigo', icon: ExternalLink },
}

export default function N8nWorkflows() {
  const queryClient = useQueryClient()
  const { settings } = useSettings()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<N8nWorkflow | null>(null)
  const [filterType, setFilterType] = useState<string>('all')

  // Fetch workflows
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['n8n-workflows', filterType],
    queryFn: async () => {
      let query = supabase
        .from('n8n_workflow_configs')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterType !== 'all') {
        query = query.eq('workflow_type', filterType)
      }

      const { data, error } = await query

      if (error) throw error
      return data as N8nWorkflow[]
    },
    enabled: !!settings?.n8n_enabled,
  })

  // Toggle workflow active state
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('n8n_workflow_configs')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
      toast.success('Workflow durumu güncellendi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  // Delete workflow
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('n8n_workflow_configs').delete().eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
      toast.success('Workflow silindi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`"${name}" workflow'unu silmek istediğinizden emin misiniz?`)) {
      deleteMutation.mutate(id)
    }
  }

  if (!settings?.n8n_enabled) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            n8n Otomasyonu Devre Dışı
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Bu özelliği kullanmak için Ayarlar sayfasından n8n özelliğini etkinleştirin.
          </p>
          <a href="/settings" className="btn-primary inline-flex items-center gap-2">
            Ayarlara Git
          </a>
        </div>
      </div>
    )
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            n8n Workflow Otomasyonları
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            İş süreçlerinizi otomatikleştirin
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Yeni Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterType === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
          }`}
        >
          Tümü ({workflows?.length || 0})
        </button>
        {Object.entries(workflowTypeLabels).map(([type, { label, color }]) => {
          const count = workflows?.filter((w) => w.workflow_type === type).length || 0
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                filterType === type
                  ? `bg-${color}-600 text-white`
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {label} ({count})
            </button>
          )
        })}
      </div>

      {/* Workflows Grid */}
      {workflows && workflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => {
            const typeInfo = workflowTypeLabels[workflow.workflow_type]
            const TypeIcon = typeInfo?.icon || Bot
            const successRate =
              workflow.total_executions > 0
                ? Math.round(
                    (workflow.successful_executions / workflow.total_executions) * 100
                  )
                : 0

            return (
              <div
                key={workflow.id}
                className="card hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedWorkflow(workflow)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg bg-${typeInfo?.color || 'gray'}-100 dark:bg-${typeInfo?.color || 'gray'}-900/20 flex items-center justify-center`}
                    >
                      <TypeIcon
                        className={`w-5 h-5 text-${typeInfo?.color || 'gray'}-600 dark:text-${typeInfo?.color || 'gray'}-400`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {workflow.workflow_name}
                      </h3>
                      <span
                        className={`text-xs text-${typeInfo?.color || 'gray'}-600 dark:text-${typeInfo?.color || 'gray'}-400`}
                      >
                        {typeInfo?.label || workflow.workflow_type}
                      </span>
                    </div>
                  </div>

                  {/* Active toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleMutation.mutate({
                        id: workflow.id,
                        is_active: !workflow.is_active,
                      })
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      workflow.is_active
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                    }`}
                  >
                    {workflow.is_active ? (
                      <Play className="w-4 h-4" />
                    ) : (
                      <Pause className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Description */}
                {workflow.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {workflow.description}
                  </p>
                )}

                {/* Trigger Type */}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {workflow.trigger_type === 'webhook' ? (
                    <Webhook className="w-4 h-4" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  <span className="capitalize">{workflow.trigger_type}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Toplam Çalışma
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {workflow.total_executions}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Başarı Oranı</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {successRate}%
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      // Edit workflow
                    }}
                    className="btn-secondary flex-1 text-sm flex items-center justify-center gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    Düzenle
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(workflow.id, workflow.workflow_name)
                    }}
                    className="btn-secondary text-red-600 dark:text-red-400 text-sm flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Henüz workflow oluşturulmamış
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            İş süreçlerinizi otomatikleştirmek için ilk workflow'unuzu oluşturun
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Workflow Oluştur
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <WorkflowCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            queryClient.invalidateQueries({ queryKey: ['n8n-workflows'] })
          }}
        />
      )}

      {/* Details Modal */}
      {selectedWorkflow && (
        <WorkflowDetailsModal
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </div>
  )
}
