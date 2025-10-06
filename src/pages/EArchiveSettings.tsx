import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { FileArchive, Save, Settings as SettingsIcon } from 'lucide-react'
import Tooltip from '@/components/Tooltip'

interface EArchiveSettings {
  id?: string
  user_id: string
  internet_sales_enabled: boolean
  default_scenario: 'TEMELFATURA' | 'TICARIFATURA'
  prefix_series: string
  current_number: number
}

export default function EArchiveSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<Partial<EArchiveSettings>>({
    internet_sales_enabled: false,
    default_scenario: 'TEMELFATURA',
    prefix_series: 'MGA',
    current_number: 0,
  })

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['e-archive-settings'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('e_archive_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data as EArchiveSettings | null
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
    mutationFn: async (data: Partial<EArchiveSettings>) => {
      if (!user) throw new Error('User not authenticated')

      const payload = {
        ...data,
        user_id: user.id,
      }

      const { error } = await supabase
        .from('e_archive_settings')
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['e-archive-settings'] })
      toast.success('E-Arşiv ayarları kaydedildi')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Kayıt başarısız')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">E-Arşiv Ayarları</h1>
          <Tooltip content="E-Arşiv fatura ayarlarını yapılandırın. Bireysel müşteriler için kullanılır." />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          E-Arşiv fatura yapılandırması (Bireysel müşteriler için)
        </p>
      </div>

      {/* Info */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <FileArchive className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">
              E-Arşiv Nedir?
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              E-Arşiv fatura, VKN'si olmayan bireysel müşterilere (tüketicilere) kesilir.
              E-Fatura sisteminden farklı olarak GİB'e portal üzerinden gönderilir ve müşteriye
              e-posta veya SMS ile iletilir.
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Scenario Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Senaryo Ayarları</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Varsayılan Senaryo *
              </label>
              <select
                value={formData.default_scenario}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_scenario: e.target.value as 'TEMELFATURA' | 'TICARIFATURA',
                  })
                }
                className="input-field"
                required
              >
                <option value="TEMELFATURA">Temel Fatura</option>
                <option value="TICARIFATURA">Ticari Fatura</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Temel Fatura: Perakende satışlar için. Ticari Fatura: B2C ticari satışlar için.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.internet_sales_enabled}
                onChange={(e) =>
                  setFormData({ ...formData, internet_sales_enabled: e.target.checked })
                }
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  İnternet Satış Belgesi
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  E-ticaret satışları için özel senaryo
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Numbering Settings */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <FileArchive className="w-5 h-5 text-primary-500" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Numaralandırma Ayarları
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Seri Ön Eki *
              </label>
              <input
                type="text"
                value={formData.prefix_series}
                onChange={(e) =>
                  setFormData({ ...formData, prefix_series: e.target.value.toUpperCase() })
                }
                placeholder="MGA"
                maxLength={3}
                className="input-field"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                3 haneli seri kodu (örn: MGA, MGS, ABC)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mevcut Numara
              </label>
              <input
                type="number"
                value={formData.current_number}
                onChange={(e) =>
                  setFormData({ ...formData, current_number: parseInt(e.target.value) || 0 })
                }
                min={0}
                className="input-field"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Bir sonraki fatura bu numaradan devam edecek
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Örnek Fatura No:</strong>{' '}
              {formData.prefix_series}
              {new Date().getFullYear()}
              {String((formData.current_number || 0) + 1).padStart(9, '0')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
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
