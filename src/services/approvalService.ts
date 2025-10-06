/**
 * Approval Workflow Service - Onay Akışı Servisi
 */

import { supabase } from '@/lib/supabase'

export type EntityType = 'invoice' | 'expense' | 'payment' | 'journal_entry'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type StepStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface ApprovalWorkflow {
  id: string
  user_id: string
  name: string
  description: string | null
  entity_type: EntityType
  trigger_conditions: Record<string, any> | null
  is_active: boolean
  created_at: string
}

export interface ApprovalWorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  approver_role_id: string
  required: boolean
  approver_role?: {
    id: string
    name: string
  }
}

export interface ApprovalWorkflowWithSteps extends ApprovalWorkflow {
  steps: ApprovalWorkflowStep[]
}

export interface ApprovalRequest {
  id: string
  workflow_id: string
  entity_type: EntityType
  entity_id: number
  requester_id: string
  current_step: number
  status: ApprovalStatus
  created_at: string
  completed_at: string | null
  workflow?: ApprovalWorkflow
  requester?: {
    email: string
  }
}

export interface ApprovalHistory {
  id: string
  request_id: string
  step_id: string
  approver_id: string
  status: StepStatus
  comments: string | null
  approved_at: string
  approver?: {
    email: string
  }
  step?: ApprovalWorkflowStep
}

export const ApprovalService = {
  /**
   * Tüm onay akışlarını getir
   */
  async getWorkflows(userId: string): Promise<ApprovalWorkflowWithSteps[]> {
    const { data, error } = await supabase
      .from('approval_workflows')
      .select(
        `
        *,
        approval_workflow_steps (
          *,
          approver_role:roles (
            id,
            name
          )
        )
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((workflow: any) => ({
      ...workflow,
      steps: workflow.approval_workflow_steps.sort(
        (a: any, b: any) => a.step_order - b.step_order
      ),
    }))
  },

  /**
   * Yeni onay akışı oluştur
   */
  async createWorkflow(
    userId: string,
    name: string,
    description: string,
    entityType: EntityType,
    triggerConditions: Record<string, any> | null,
    steps: { approverRoleId: string; required: boolean }[]
  ): Promise<string> {
    // 1. Workflow oluştur
    const { data: workflow, error: workflowError } = await supabase
      .from('approval_workflows')
      .insert({
        user_id: userId,
        name,
        description,
        entity_type: entityType,
        trigger_conditions: triggerConditions,
        is_active: true,
      })
      .select()
      .single()

    if (workflowError) throw workflowError

    // 2. Adımları ekle
    if (steps.length > 0) {
      const workflowSteps = steps.map((step, index) => ({
        workflow_id: workflow.id,
        step_order: index + 1,
        approver_role_id: step.approverRoleId,
        required: step.required,
      }))

      const { error: stepsError } = await supabase
        .from('approval_workflow_steps')
        .insert(workflowSteps)

      if (stepsError) throw stepsError
    }

    return workflow.id
  },

  /**
   * Onay akışını güncelle
   */
  async updateWorkflow(
    workflowId: string,
    userId: string,
    name: string,
    description: string,
    triggerConditions: Record<string, any> | null,
    steps: { approverRoleId: string; required: boolean }[]
  ): Promise<void> {
    // 1. Workflow güncelle
    const { error: updateError } = await supabase
      .from('approval_workflows')
      .update({
        name,
        description,
        trigger_conditions: triggerConditions,
      })
      .eq('id', workflowId)
      .eq('user_id', userId)

    if (updateError) throw updateError

    // 2. Mevcut adımları sil
    await supabase.from('approval_workflow_steps').delete().eq('workflow_id', workflowId)

    // 3. Yeni adımları ekle
    if (steps.length > 0) {
      const workflowSteps = steps.map((step, index) => ({
        workflow_id: workflowId,
        step_order: index + 1,
        approver_role_id: step.approverRoleId,
        required: step.required,
      }))

      const { error: stepsError } = await supabase
        .from('approval_workflow_steps')
        .insert(workflowSteps)

      if (stepsError) throw stepsError
    }
  },

  /**
   * Onay akışını sil
   */
  async deleteWorkflow(workflowId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('approval_workflows')
      .delete()
      .eq('id', workflowId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Onay akışını aktif/pasif yap
   */
  async toggleWorkflow(workflowId: string, userId: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('approval_workflows')
      .update({ is_active: isActive })
      .eq('id', workflowId)
      .eq('user_id', userId)

    if (error) throw error
  },

  /**
   * Onay talebi oluştur
   */
  async createApprovalRequest(
    workflowId: string,
    entityType: EntityType,
    entityId: number,
    requesterId: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('approval_requests')
      .insert({
        workflow_id: workflowId,
        entity_type: entityType,
        entity_id: entityId,
        requester_id: requesterId,
        current_step: 1,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error
    return data.id
  },

  /**
   * Bekleyen onay taleplerini getir
   */
  async getPendingRequests(userId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await supabase
      .from('approval_requests')
      .select(
        `
        *,
        workflow:approval_workflows (*),
        requester:auth.users!approval_requests_requester_id_fkey (email)
      `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Tüm onay taleplerini getir (yönetici için)
   */
  async getAllRequests(userId: string): Promise<ApprovalRequest[]> {
    const { data, error } = await supabase
      .from('approval_requests')
      .select(
        `
        *,
        workflow:approval_workflows!inner (
          *
        ),
        requester:auth.users!approval_requests_requester_id_fkey (email)
      `
      )
      .eq('workflow.user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Onay işlemi yap
   */
  async approveStep(
    requestId: string,
    stepId: string,
    approverId: string,
    status: 'approved' | 'rejected',
    comments: string | null
  ): Promise<void> {
    // 1. Onay geçmişine kaydet
    const { error: historyError } = await supabase.from('approval_history').insert({
      request_id: requestId,
      step_id: stepId,
      approver_id: approverId,
      status,
      comments,
    })

    if (historyError) throw historyError

    // 2. Request durumunu güncelle
    if (status === 'rejected') {
      // Reddedilirse talebi reddet
      const { error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateError) throw updateError
    } else {
      // Onaylandıysa sonraki adıma geç veya tamamla
      const { data: request } = await supabase
        .from('approval_requests')
        .select('*, workflow:approval_workflows!inner(approval_workflow_steps(*))')
        .eq('id', requestId)
        .single()

      if (request) {
        const totalSteps = request.workflow.approval_workflow_steps.length
        const nextStep = request.current_step + 1

        if (nextStep > totalSteps) {
          // Tüm adımlar tamamlandı
          await supabase
            .from('approval_requests')
            .update({
              status: 'approved',
              completed_at: new Date().toISOString(),
            })
            .eq('id', requestId)
        } else {
          // Sonraki adıma geç
          await supabase
            .from('approval_requests')
            .update({ current_step: nextStep })
            .eq('id', requestId)
        }
      }
    }
  },

  /**
   * Onay geçmişini getir
   */
  async getApprovalHistory(requestId: string): Promise<ApprovalHistory[]> {
    const { data, error } = await supabase
      .from('approval_history')
      .select(
        `
        *,
        approver:auth.users!approval_history_approver_id_fkey (email),
        step:approval_workflow_steps (*)
      `
      )
      .eq('request_id', requestId)
      .order('approved_at', { ascending: true })

    if (error) throw error
    return data || []
  },
}
