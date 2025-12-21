import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import { getErrorMessage } from '@/utils/error'
import {
  User,
  Building2,
  Bell,
  Moon,
  Sun,
  Save,
  Mail,
  Phone,
  MapPin,
  Globe,
  Zap,
  Bot,
  Brain,
  ScanLine,
  Tag,
  TrendingUp,
  MessageSquare,
  Key,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface CompanySettings {
  id?: string
  user_id: string
  company_name: string
  tax_number: string
  address: string
  phone: string
  email: string
  website: string
  currency: string
  tax_rate: number
  invoice_prefix: string
}

export default function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { settings: appSettings, updateSetting, isUpdating } = useSettings()

  // Initialize dark mode from localStorage or system preference
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode')
    if (savedMode !== null) {
      return savedMode === 'true'
    }
    // Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // OpenAI API Key state
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [isTestingKey, setIsTestingKey] = useState(false)
  const [isSavingKey, setIsSavingKey] = useState(false)

  // Apply dark mode on component mount and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', darkMode.toString())
  }, [darkMode])

  // Fetch company settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as CompanySettings | null
    },
    enabled: !!user,
  })

  const [formData, setFormData] = useState<Partial<CompanySettings>>({
    company_name: '',
    tax_number: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'TRY',
    tax_rate: 20,
    invoice_prefix: 'INV',
  })

  // Update form data when settings are loaded - useEffect ile
  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name,
        tax_number: settings.tax_number,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        currency: settings.currency,
        tax_rate: settings.tax_rate,
        invoice_prefix: settings.invoice_prefix,
      })
    }
  }, [settings])

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      if (!user) throw new Error('User not authenticated')

      if (settings?.id) {
        // Update existing settings
        const { error } = await supabase
          .from('company_settings')
          .update(data)
          .eq('id', settings.id)
        if (error) throw error
      } else {
        // Insert new settings
        const { error } = await supabase.from('company_settings').insert([
          {
            ...data,
            user_id: user.id,
          },
        ])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] })
      toast.success('Ayarlar kaydedildi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  // Handle OpenAI API Key Save
  const handleSaveOpenAIKey = async () => {
    if (!openaiApiKey.trim()) {
      toast.error('API Key giriniz')
      return
    }

    setIsSavingKey(true)

    try {
      const { data, error } = await supabase.functions.invoke('set-openai-key', {
        body: {
          api_key: openaiApiKey,
          test_connection: false,
        },
      })

      if (error) throw error

      if (data.success) {
        toast.success('OpenAI API Key kaydedildi')
        setOpenaiApiKey('')
        queryClient.invalidateQueries({ queryKey: ['app-settings'] })
      } else {
        throw new Error(data.message || 'API Key kaydedilemedi')
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSavingKey(false)
    }
  }

  // Handle OpenAI API Key Test
  const handleTestOpenAIKey = async () => {
    if (!openaiApiKey.trim()) {
      toast.error('API Key giriniz')
      return
    }

    setIsTestingKey(true)

    try {
      const { data, error } = await supabase.functions.invoke('set-openai-key', {
        body: {
          api_key: openaiApiKey,
          test_connection: true,
        },
      })

      if (error) throw error

      if (data.success && data.test_result?.success) {
        toast.success(`API Key geçerli! Model: ${data.test_result.model}`)
        setOpenaiApiKey('')
        queryClient.invalidateQueries({ queryKey: ['app-settings'] })
      } else {
        const errorMsg = data.test_result?.error || data.message || 'API Key test edilemedi'
        toast.error(errorMsg)
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsTestingKey(false)
    }
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ayarlar</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Uygulama ayarlarınızı yönetin
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Section */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Profile */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profil</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Görünüm</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="text-gray-900 dark:text-white">Karanlık Mod</span>
                </div>
                <button
                  onClick={toggleDarkMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    darkMode ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Company Settings Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="card">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Şirket Bilgileri
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Şirket Adı
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) =>
                      setFormData({ ...formData, company_name: e.target.value })
                    }
                    className="input-field"
                    placeholder="Örn: ABC Yazılım Ltd."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vergi Numarası
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_number: e.target.value })
                    }
                    className="input-field"
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Şirket adresi..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-field"
                    placeholder="+90 555 123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                    placeholder="info@sirket.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="input-field"
                  placeholder="https://sirket.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Para Birimi
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="input-field"
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Varsayılan KDV (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_rate: Number(e.target.value) })
                    }
                    className="input-field"
                    placeholder="20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fatura Öneki
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_prefix}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_prefix: e.target.value })
                    }
                    className="input-field"
                    placeholder="INV"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saveMutation.isPending ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Feature Flags Section (Admin Only) */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Otomasyon & AI Özellikleri
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              İsteğe bağlı özellikler - Ana uygulama fonksiyonlarını etkilemeden açılıp
              kapatılabilir
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* n8n Workflow Automation */}
          <div className="border-b border-gray-200 dark:border-slate-700 pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    n8n Workflow Otomasyonu
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Fatura onay, ödeme hatırlatma, tekrarlayan faturalar ve otomatik süreçler
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  updateSetting('n8n_enabled', !appSettings?.n8n_enabled)
                }
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  appSettings?.n8n_enabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    appSettings?.n8n_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {appSettings?.n8n_enabled && (
              <div className="ml-8 mt-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  n8n Webhook Base URL
                </label>
                <input
                  type="url"
                  value={appSettings?.n8n_webhook_base_url || ''}
                  onChange={(e) =>
                    updateSetting('n8n_webhook_base_url', e.target.value)
                  }
                  className="input-field max-w-md"
                  placeholder="http://localhost:5678"
                />
              </div>
            )}
          </div>

          {/* AI Features Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                AI Özellikleri
              </h3>
            </div>

            <div className="space-y-4 ml-7">
              {/* OpenAI API Key Configuration */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        OpenAI API Key
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        AI özelliklerini kullanmak için OpenAI API Key'inizi girin
                      </p>
                    </div>

                    {/* API Key Status */}
                    <div className="flex items-center gap-2">
                      {appSettings?.openai_api_key_set ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                            API Key ayarlanmış
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                            API Key ayarlanmamış
                          </span>
                        </>
                      )}
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={openaiApiKey}
                        onChange={(e) => setOpenaiApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="input-field w-full"
                        disabled={isSavingKey || isTestingKey}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        API Key'iniz güvenli şekilde şifrelenerek saklanır. OpenAI API Key'inizi{' '}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          buradan
                        </a>{' '}
                        alabilirsiniz.
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleTestOpenAIKey}
                        disabled={!openaiApiKey.trim() || isTestingKey || isSavingKey}
                        className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isTestingKey ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Test Ediliyor...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Test Et
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleSaveOpenAIKey}
                        disabled={!openaiApiKey.trim() || isTestingKey || isSavingKey}
                        className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSavingKey ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Kaydediliyor...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Kaydet
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-slate-700 my-4"></div>
              {/* AI OCR */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ScanLine className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      AI Fatura Tarama (OCR)
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fatura görsellerinden otomatik veri çıkarma (GPT-4 Vision)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateSetting('ai_ocr_enabled', !appSettings?.ai_ocr_enabled)
                  }
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    appSettings?.ai_ocr_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      appSettings?.ai_ocr_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* AI Categorization */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-green-500 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Akıllı Kategorizasyon
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Gider ve faturaları otomatik kategorilere ayır
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateSetting(
                      'ai_categorization_enabled',
                      !appSettings?.ai_categorization_enabled
                    )
                  }
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    appSettings?.ai_categorization_enabled
                      ? 'bg-green-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      appSettings?.ai_categorization_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* AI Predictions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-orange-500 dark:text-orange-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Finansal Tahminler
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Nakit akışı, gelir ve ödeme olasılığı tahminleri
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateSetting(
                      'ai_predictions_enabled',
                      !appSettings?.ai_predictions_enabled
                    )
                  }
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    appSettings?.ai_predictions_enabled
                      ? 'bg-orange-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      appSettings?.ai_predictions_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* AI Chatbot */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">AI Asistan</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Sorularınız ve yönlendirme için AI chatbot
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    updateSetting('ai_chatbot_enabled', !appSettings?.ai_chatbot_enabled)
                  }
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    appSettings?.ai_chatbot_enabled
                      ? 'bg-pink-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      appSettings?.ai_chatbot_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
