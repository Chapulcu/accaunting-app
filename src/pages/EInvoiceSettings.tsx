import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { FileCheck, Save, Settings as SettingsIcon, Key, Building2, TestTube } from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import type { EInvoiceSettings } from '@/services/eInvoiceService'

export default function EInvoiceSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<EInvoiceSettings>>({
    provider: 'custom',
    environment: 'test',
    auto_send: false,
    auto_create_journal: true,
    is_active: false,
  })

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['e-invoice-settings'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('e_invoice_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as EInvoiceSettings | null
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<EInvoiceSettings>) => {
      if (!user) throw new Error('User not authenticated')

      const payload = {
        ...data,
        user_id: user.id,
      }

      const { error } = await supabase
        .from('e_invoice_settings')
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['e-invoice-settings'] })
      toast.success('E-Fatura ayarları kaydedildi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kayıt başarısız')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const testConnection = async () => {
    toast.loading('Bağlantı test ediliyor...', { id: 'test-connection' })

    // Mock test - gerçek implementasyonda provider API'sine istek atılır
    setTimeout(() => {
      if (formData.provider === 'custom') {
        toast.success('Mock provider bağlantısı başarılı!', { id: 'test-connection' })
      } else {
        toast.error('Bağlantı hatası: API credentials kontrol edin', { id: 'test-connection' })
      }
    }, 1500)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">E-Fatura Ayarları</h1>
          <Tooltip content="E-Fatura entegratörü ayarlarını yapılandırın. GİB'e otomatik fatura gönderimi için gerekli bilgileri girin." />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">E-Belge entegrasyonu yapılandırması</p>
      </div>

      {/* Warning */}
      {!settings?.is_active && (
        <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex gap-3">
            <FileCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                E-Fatura Entegrasyonu Pasif
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                E-Fatura gönderebilmek için entegratör ayarlarını yapılandırın ve sistemi aktif edin.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Entegratör Ayarları</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                E-Fatura Sağlayıcı *
              </label>
              <select
                value={formData.provider}
                onChange={(e) =>
                  setFormData({ ...formData, provider: e.target.value as any })
                }
                className="input-field"
                required
              >
                <option value="custom">Mock Provider (Test)</option>
                <option value="foriba">Foriba</option>
                <option value="biges">Biges</option>
                <option value="uyumsoft">Uyumsoft</option>
              </select>
            </div>

            {/* Environment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ortam *
              </label>
              <select
                value={formData.environment}
                onChange={(e) =>
                  setFormData({ ...formData, environment: e.target.value as any })
                }
                className="input-field"
                required
              >
                <option value="test">Test</option>
                <option value="production">Canlı (Production)</option>
              </select>
            </div>
          </div>
        </div>

        {/* API Credentials */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">API Bilgileri</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API URL */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API URL
              </label>
              <input
                type="url"
                value={formData.api_url || ''}
                onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                placeholder="https://api.provider.com"
                className="input-field"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Kullanıcı Adı
              </label>
              <input
                type="text"
                value={formData.api_username || ''}
                onChange={(e) => setFormData({ ...formData, api_username: e.target.value })}
                placeholder="username"
                className="input-field"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Şifre
              </label>
              <input
                type="password"
                value={formData.api_password || ''}
                onChange={(e) => setFormData({ ...formData, api_password: e.target.value })}
                placeholder="••••••••"
                className="input-field"
              />
            </div>

            {/* API Key */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key (Opsiyonel)
              </label>
              <input
                type="text"
                value={formData.api_key || ''}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="your-api-key-here"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Şirket Bilgileri</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* VKN */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vergi Kimlik No (VKN) *
              </label>
              <input
                type="text"
                value={formData.vkn || ''}
                onChange={(e) => setFormData({ ...formData, vkn: e.target.value })}
                placeholder="1234567890"
                maxLength={10}
                className="input-field"
                required
              />
            </div>

            {/* Company Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Şirket Ünvanı *
              </label>
              <input
                type="text"
                value={formData.company_title || ''}
                onChange={(e) => setFormData({ ...formData, company_title: e.target.value })}
                placeholder="ABC Ticaret Ltd. Şti."
                className="input-field"
                required
              />
            </div>

            {/* Tax Office */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vergi Dairesi
              </label>
              <input
                type="text"
                value={formData.tax_office || ''}
                onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                placeholder="Kadıköy"
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Otomasyon Ayarları
          </h2>

          <div className="space-y-4">
            {/* Auto Send */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.auto_send}
                onChange={(e) => setFormData({ ...formData, auto_send: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Otomatik Gönderim</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Fatura oluşturulduğunda otomatik olarak e-fatura gönder
                </p>
              </div>
            </label>

            {/* Auto Create Journal */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.auto_create_journal}
                onChange={(e) =>
                  setFormData({ ...formData, auto_create_journal: e.target.checked })
                }
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Otomatik Yevmiye Kaydı
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  E-Fatura onaylandığında otomatik yevmiye kaydı oluştur
                </p>
              </div>
            </label>

            {/* Active */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Sistemi Aktif Et</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  E-Fatura entegrasyonunu etkinleştir
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={testConnection}
            className="btn-secondary flex items-center gap-2"
          >
            <TestTube className="w-5 h-5" />
            Bağlantıyı Test Et
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}
