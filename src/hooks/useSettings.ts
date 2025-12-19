import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'

export interface AppSettings {
  id: number
  company_name: string | null
  tax_office: string | null
  tax_number: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  currency: string
  date_format: string
  fiscal_year_start: string
  enable_multi_currency: boolean
  enable_tax_calculation: boolean
  default_payment_terms: number
  invoice_prefix: string
  invoice_number_length: number
  next_invoice_number: number
  enable_email_notifications: boolean
  smtp_configured: boolean
  created_at: string
  updated_at: string
  // Feature flags for n8n and AI
  n8n_enabled: boolean
  n8n_webhook_base_url: string | null
  ai_ocr_enabled: boolean
  ai_categorization_enabled: boolean
  ai_predictions_enabled: boolean
  ai_chatbot_enabled: boolean
  openai_api_key_set: boolean
}

interface UpdateSettingsData {
  [key: string]: any
}

export function useSettings() {
  const queryClient = useQueryClient()

  // Fetch app settings
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery<AppSettings>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single()

      if (error) {
        console.error('Error fetching app settings:', error)
        throw new Error(error.message)
      }

      return data
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateSettingsData) => {
      const { data, error } = await supabase
        .from('app_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings?.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      toast.success('Ayarlar başarıyla güncellendi')
    },
    onError: (error: any) => {
      const errorMessage = getErrorMessage(error) || 'Ayarlar güncellenemedi'
      toast.error(errorMessage)
    },
  })

  // Helper function to update a single setting
  const updateSetting = async (key: string, value: any) => {
    await updateMutation.mutateAsync({ [key]: value })
  }

  // Helper function to update multiple settings
  const updateSettings = async (updates: UpdateSettingsData) => {
    await updateMutation.mutateAsync(updates)
  }

  // Feature flag helpers
  const isFeatureEnabled = (featureName: keyof AppSettings): boolean => {
    if (!settings) return false
    return Boolean(settings[featureName])
  }

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSetting,
    updateSettings,
    isUpdating: updateMutation.isPending,
    // Feature flag helpers
    isFeatureEnabled,
    isN8nEnabled: isFeatureEnabled('n8n_enabled'),
    isAIOCREnabled: isFeatureEnabled('ai_ocr_enabled'),
    isAICategorizationEnabled: isFeatureEnabled('ai_categorization_enabled'),
    isAIPredictionsEnabled: isFeatureEnabled('ai_predictions_enabled'),
    isAIChatbotEnabled: isFeatureEnabled('ai_chatbot_enabled'),
  }
}
