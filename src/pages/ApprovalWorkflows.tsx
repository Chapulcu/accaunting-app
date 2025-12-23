import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  GitBranch,
  Plus,
  X,
  Edit2,
  Trash2,
  Power,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Receipt,
  Wallet,
  BookMarked,
  ArrowRight,
} from 'lucide-react'
import { ApprovalService } from '@/services/approvalService'
import { RBACService } from '@/services/rbacService'
import type {
  ApprovalWorkflowWithSteps,
  EntityType,
  ApprovalRequest,
} from '@/services/approvalService'
import Tooltip from '@/components/Tooltip'

export default function ApprovalWorkflows() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [showRequestsModal, setShowRequestsModal] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflowWithSteps | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entityType: 'invoice' as EntityType,
    triggerAmount: '',
    steps: [{ approverRoleId: '', required: true }],
  })

  // Fetch workflows
  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      return await ApprovalService.getWorkflows(user.id)
    },
    enabled: !!user,
  })

  // Fetch roles
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      return await RBACService.getUserRoles(user.id)
    },
    enabled: !!user,
  })

  // Fetch approval requests
  const { data: requests } = useQuery({
    queryKey: ['approval-requests'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')
      return await ApprovalService.getAllRequests(user.id)
    },
    enabled: !!user,
  })

  // Fetch approval history
  const { data: history } = useQuery({
    queryKey: ['approval-history', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return []
      return await ApprovalService.getApprovalHistory(selectedRequest.id)
    },
    enabled: !!selectedRequest,
  })

  // Save workflow mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const triggerConditions = formData.triggerAmount
        ? { min_amount: parseFloat(formData.triggerAmount) }
        : null

      const steps = formData.steps.map((s) => ({
        approverRoleId: s.approverRoleId,
        required: s.required,
      }))

      if (selectedWorkflow) {
        await ApprovalService.updateWorkflow(
          selectedWorkflow.id,
          user.id,
          formData.name,
          formData.description,
          triggerConditions,
          steps
        )
      } else {
        await ApprovalService.createWorkflow(
          user.id,
          formData.name,
          formData.description,
          formData.entityType,
          triggerConditions,
          steps
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      toast.success(selectedWorkflow ? 'Akış güncellendi' : 'Akış oluşturuldu')
      handleCloseModal()
    },
    onError: (error: any) => {
      toast.error(error.message || 'İşlem başarısız')
    },
  })

  // Delete workflow mutation
  const deleteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      if (!user) throw new Error('User not authenticated')
      await ApprovalService.deleteWorkflow(workflowId, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      toast.success('Akış silindi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Silme başarısız')
    },
  })

  // Toggle workflow mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!user) throw new Error('User not authenticated')
      await ApprovalService.toggleWorkflow(id, user.id, isActive)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] })
      toast.success('Durum güncellendi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'İşlem başarısız')
    },
  })

  const handleOpenModal = (workflow?: ApprovalWorkflowWithSteps) => {
    if (workflow) {
      setSelectedWorkflow(workflow)
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        entityType: workflow.entity_type,
        triggerAmount: workflow.trigger_conditions?.min_amount?.toString() || '',
        steps: workflow.steps.map((s) => ({
          approverRoleId: s.approver_role_id,
          required: s.required,
        })),
      })
    } else {
      setSelectedWorkflow(null)
      setFormData({
        name: '',
        description: '',
        entityType: 'invoice',
        triggerAmount: '',
        steps: [{ approverRoleId: '', required: true }],
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedWorkflow(null)
  }

  const addStep = () => {
    setFormData({
      ...formData,
      steps: [...formData.steps, { approverRoleId: '', required: true }],
    })
  }

  const removeStep = (index: number) => {
    setFormData({
      ...formData,
      steps: formData.steps.filter((_, i) => i !== index),
    })
  }

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...formData.steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setFormData({ ...formData, steps: newSteps })
  }

  const entityTypeLabels: Record<EntityType, string> = {
    invoice: 'Faturalar',
    expense: 'Giderler',
    payment: 'Ödemeler',
    journal_entry: 'Yevmiye Kayıtları',
  }

  const entityTypeIcons: Record<EntityType, any> = {
    invoice: FileText,
    expense: Receipt,
    payment: Wallet,
    journal_entry: BookMarked,
  }

  const pendingRequests = requests?.filter((r) => r.status === 'pending') || []
  const approvedRequests = requests?.filter((r) => r.status === 'approved') || []
  const rejectedRequests = requests?.filter((r) => r.status === 'rejected') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Onay Akışları</h1>
            <Tooltip content="İşlemler için otomatik onay süreçleri tanımlayın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Onay süreçlerini yönetin ve takip edin
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRequestsModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Clock className="w-5 h-5" />
            Onay Talepleri ({pendingRequests.length})
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Yeni Akış
          </button>
        </div>
      </div>

      {/* Workflows List */}
      {workflowsLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workflows.map((workflow) => {
            const Icon = entityTypeIcons[workflow.entity_type]
            return (
              <div key={workflow.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        workflow.is_active
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          workflow.is_active
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{workflow.name}</h3>
                      {workflow.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      toggleMutation.mutate({ id: workflow.id, isActive: !workflow.is_active })
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      workflow.is_active
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Power className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Kapsam:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entityTypeLabels[workflow.entity_type]}
                    </span>
                  </div>

                  {workflow.trigger_conditions?.min_amount && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Tetiklenme:</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {workflow.trigger_conditions.min_amount.toLocaleString('tr-TR')} TL üzeri
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Onay Adımları ({workflow.steps.length}):
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {workflow.steps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                            {step.approver_role?.name}
                            {step.required && '*'}
                          </span>
                          {index < workflow.steps.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => handleOpenModal(workflow)}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Düzenle
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(workflow.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">Henüz onay akışı tanımlanmamış</p>
          <button onClick={() => handleOpenModal()} className="btn-primary mx-auto">
            İlk Akışı Oluştur
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-3xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedWorkflow ? 'Akış Düzenle' : 'Yeni Onay Akışı'}
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                saveMutation.mutate()
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Akış Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="Örn: Yüksek Tutarlı Fatura Onayı"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    İşlem Türü *
                  </label>
                  <select
                    required
                    value={formData.entityType}
                    onChange={(e) =>
                      setFormData({ ...formData, entityType: e.target.value as EntityType })
                    }
                    className="input-field"
                    disabled={!!selectedWorkflow}
                  >
                    {Object.entries(entityTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Akışın ne zaman tetikleneceğini açıklayın"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Tutar (TL) - Opsiyonel
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.triggerAmount}
                  onChange={(e) => setFormData({ ...formData, triggerAmount: e.target.value })}
                  className="input-field"
                  placeholder="Bu tutarın üzerindeki işlemler için akışı tetikle"
                />
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Onay Adımları
                  </h3>
                  <button type="button" onClick={addStep} className="btn-secondary text-sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Adım Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.steps.map((step, index) => (
                    <div key={index} className="card bg-gray-50 dark:bg-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select
                            required
                            value={step.approverRoleId}
                            onChange={(e) => updateStep(index, 'approverRoleId', e.target.value)}
                            className="input-field"
                          >
                            <option value="">Onaylayacak Rolü Seçin</option>
                            {roles?.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={step.required}
                              onChange={(e) => updateStep(index, 'required', e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            Zorunlu Adım
                          </label>
                        </div>
                        {formData.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  İptal
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1">
                  {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Requests Modal */}
      {showRequestsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-6xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Onay Talepleri</h2>
              <button
                onClick={() => setShowRequestsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="card bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Bekleyen</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {pendingRequests.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="card bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Onaylanan</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {approvedRequests.length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Reddedilen</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {rejectedRequests.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Requests List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {requests && requests.length > 0 ? (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className={`card cursor-pointer hover:shadow-md transition-shadow ${
                      request.status === 'pending'
                        ? 'border-l-4 border-yellow-500'
                        : request.status === 'approved'
                        ? 'border-l-4 border-green-500'
                        : 'border-l-4 border-red-500'
                    }`}
                    onClick={() => {
                      setSelectedRequest(request)
                      setShowHistoryModal(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {request.status === 'pending' ? (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        ) : request.status === 'approved' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {entityTypeLabels[request.entity_type]} #{request.entity_id}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Talep eden: {request.requester?.email}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(request.created_at).toLocaleDateString('tr-TR')}
                        </p>
                        {request.status === 'pending' && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Adım {request.current_step}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                  Henüz onay talebi yok
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="card max-w-2xl w-full my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Onay Geçmişi</h2>
              <button
                onClick={() => {
                  setShowHistoryModal(false)
                  setSelectedRequest(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {history && history.length > 0 ? (
                history.map((item, index) => (
                  <div key={item.id} className="card bg-gray-50 dark:bg-slate-800">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {item.status === 'approved' ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : item.status === 'rejected' ? (
                          <XCircle className="w-6 h-6 text-red-600" />
                        ) : (
                          <Clock className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          Adım {index + 1}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.approver?.email}
                        </p>
                        {item.comments && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                            "{item.comments}"
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(item.approved_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                  Henüz onay işlemi yapılmamış
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
