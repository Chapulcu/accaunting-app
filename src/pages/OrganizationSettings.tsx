import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Building2, Save, Loader2, Globe, Mail, Phone, MapPin, CreditCard, Calendar } from 'lucide-react'
import { OrganizationService, UpdateOrganizationData } from '@/services/organizationService'
import Tooltip from '@/components/Tooltip'

export default function OrganizationSettings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  // Fetch organization
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => OrganizationService.getCurrentOrganization(),
  })

  // Form state
  const [formData, setFormData] = useState<UpdateOrganizationData>({})

  // Initialize form data when organization loads
  useState(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        description: organization.description,
        tax_number: organization.tax_number,
        tax_office: organization.tax_office,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        city: organization.city,
        country: organization.country,
        postal_code: organization.postal_code,
        website: organization.website,
        currency: organization.currency,
        tax_rate: organization.tax_rate,
        invoice_prefix: organization.invoice_prefix,
        fiscal_year_start: organization.fiscal_year_start,
      })
    }
  })

  // Update organization mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateOrganizationData) => {
      if (!organization) throw new Error('Organizasyon bulunamadı')
      return OrganizationService.updateOrganization(organization.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] })
      toast.success('Organizasyon ayarları güncellendi')
      setIsEditing(false)
    },
    onError: (error: any) => {
      console.error('Update error:', error)
      toast.error(error.message || 'Güncelleme başarısız oldu')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(formData)
  }

  const handleCancel = () => {
    if (organization) {
      setFormData({
        name: organization.name,
        description: organization.description,
        tax_number: organization.tax_number,
        tax_office: organization.tax_office,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        city: organization.city,
        country: organization.country,
        postal_code: organization.postal_code,
        website: organization.website,
        currency: organization.currency,
        tax_rate: organization.tax_rate,
        invoice_prefix: organization.invoice_prefix,
        fiscal_year_start: organization.fiscal_year_start,
      })
    }
    setIsEditing(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Organizasyon Bulunamadı
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Henüz bir organizasyona üye değilsiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Organizasyon Ayarları
            </h1>
            <Tooltip content="Organizasyonunuzun genel bilgilerini ve ayarlarını yönetin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Şirket bilgilerini ve muhasebe ayarlarını düzenleyin
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary"
          >
            Düzenle
          </button>
        )}
      </div>

      {/* Subscription Info */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Abonelik Planı
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Mevcut plan ve durum
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-5 h-5 text-gray-400" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                {organization.subscription_plan}
              </span>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                organization.subscription_status === 'active'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : organization.subscription_status === 'trial'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}
            >
              {organization.subscription_status === 'active' && 'Aktif'}
              {organization.subscription_status === 'trial' && 'Deneme'}
              {organization.subscription_status === 'past_due' && 'Gecikmiş'}
              {organization.subscription_status === 'canceled' && 'İptal Edildi'}
              {organization.subscription_status === 'suspended' && 'Askıya Alındı'}
            </span>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Temel Bilgiler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organizasyon Adı *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug (URL)
              </label>
              <input
                type="text"
                value={organization.slug}
                disabled
                className="input bg-gray-100 dark:bg-slate-700 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Slug değiştirilemez
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Açıklama
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!isEditing}
                className="input"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Tax & Legal Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vergi ve Yasal Bilgiler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vergi/TC No
              </label>
              <input
                type="text"
                value={formData.tax_number || ''}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vergi Dairesi
              </label>
              <input
                type="text"
                value={formData.tax_office || ''}
                onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5" />
            İletişim Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Website
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  disabled={!isEditing}
                  className="input pl-10"
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Adres Bilgileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Adres
              </label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isEditing}
                className="input"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Şehir
              </label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Posta Kodu
              </label>
              <input
                type="text"
                value={formData.postal_code || ''}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ülke
              </label>
              <input
                type="text"
                value={formData.country || 'TR'}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                disabled={!isEditing}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Accounting Settings */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Muhasebe Ayarları
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Para Birimi
              </label>
              <select
                value={formData.currency || 'TRY'}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as any })}
                disabled={!isEditing}
                className="input"
              >
                <option value="TRY">TRY - Türk Lirası</option>
                <option value="USD">USD - Amerikan Doları</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - İngiliz Sterlini</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Varsayılan KDV Oranı (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.tax_rate || 20}
                onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) })}
                disabled={!isEditing}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fatura Öneki
              </label>
              <input
                type="text"
                value={formData.invoice_prefix || 'INV'}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                disabled={!isEditing}
                className="input"
                placeholder="INV"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mali Yıl Başlangıcı (Ay)
              </label>
              <select
                value={formData.fiscal_year_start || 1}
                onChange={(e) => setFormData({ ...formData, fiscal_year_start: parseInt(e.target.value) })}
                disabled={!isEditing}
                className="input"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {new Date(2024, month - 1).toLocaleDateString('tr-TR', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              className="btn-secondary"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Değişiklikleri Kaydet
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
