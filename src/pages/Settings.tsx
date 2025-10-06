import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
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
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains('dark')
  )

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
    if (darkMode) {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
    setDarkMode(!darkMode)
    localStorage.setItem('darkMode', (!darkMode).toString())
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
    </div>
  )
}
