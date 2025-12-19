import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'
import { X, Bot, Webhook, Calendar } from 'lucide-react'

interface WorkflowCreateModalProps {
  onClose: () => void
  onSuccess: () => void
}

const workflowTypes = [
  { value: 'approval', label: 'Onay Süreci', description: 'Fatura onay süreçleri' },
  { value: 'reminder', label: 'Hatırlatma', description: 'Ödeme hatırlatmaları' },
  { value: 'recurring', label: 'Tekrarlayan', description: 'Tekrarlayan faturalar' },
  { value: 'sync', label: 'Senkronizasyon', description: 'Veri senkronizasyonu' },
  { value: 'e-invoice', label: 'E-Fatura', description: 'E-fatura otomasyonu' },
]

const triggerTypes = [
  { value: 'webhook', label: 'Webhook', icon: Webhook },
  { value: 'schedule', label: 'Zamanlama', icon: Calendar },
  { value: 'manual', label: 'Manuel', icon: Bot },
]

export default function WorkflowCreateModal({ onClose, onSuccess }: WorkflowCreateModalProps) {
  const [formData, setFormData] = useState({
    workflow_name: '',
    workflow_type: 'approval',
    trigger_type: 'webhook',
    webhook_url: '',
    schedule_cron: '',
    description: '',
    is_active: true,
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('n8n_workflow_configs').insert([
        {
          ...data,
          trigger_config: {},
        },
      ])

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Workflow oluşturuldu')
      onSuccess()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.workflow_name) {
      toast.error('Workflow adı gerekli')
      return
    }

    if (formData.trigger_type === 'webhook' && !formData.webhook_url) {
      toast.error('Webhook URL gerekli')
      return
    }

    if (formData.trigger_type === 'schedule' && !formData.schedule_cron) {
      toast.error('Cron ifadesi gerekli')
      return
    }

    createMutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            Yeni Workflow Oluştur
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Workflow Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workflow Adı *
            </label>
            <input
              type="text"
              value={formData.workflow_name}
              onChange={(e) => setFormData({ ...formData, workflow_name: e.target.value })}
              className="input-field"
              placeholder="Örn: Fatura Onay Süreci"
              required
            />
          </div>

          {/* Workflow Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workflow Tipi *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {workflowTypes.map((type) => (
                <label
                  key={type.value}
                  className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.workflow_type === type.value
                      ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="workflow_type"
                    value={type.value}
                    checked={formData.workflow_type === type.value}
                    onChange={(e) =>
                      setFormData({ ...formData, workflow_type: e.target.value })
                    }
                    className="sr-only"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-white">{type.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tetikleyici Tipi *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {triggerTypes.map((type) => {
                const Icon = type.icon
                return (
                  <label
                    key={type.value}
                    className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      formData.trigger_type === type.value
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="trigger_type"
                      value={type.value}
                      checked={formData.trigger_type === type.value}
                      onChange={(e) =>
                        setFormData({ ...formData, trigger_type: e.target.value })
                      }
                      className="sr-only"
                    />
                    <Icon className="w-6 h-6 mb-2 text-gray-600 dark:text-gray-400" />
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Webhook URL */}
          {formData.trigger_type === 'webhook' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL *
              </label>
              <input
                type="url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                className="input-field"
                placeholder="http://localhost:5678/webhook/..."
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                n8n webhook URL'inizi girin
              </p>
            </div>
          )}

          {/* Schedule Cron */}
          {formData.trigger_type === 'schedule' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cron İfadesi *
              </label>
              <input
                type="text"
                value={formData.schedule_cron}
                onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                className="input-field"
                placeholder="0 9 * * *"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Örnek: "0 9 * * *" = Her gün saat 09:00
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Workflow hakkında açıklama..."
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Aktif Durumu</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Workflow oluşturulduktan sonra hemen aktif olsun mu?
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_active ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              İptal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex-1"
            >
              {createMutation.isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
