import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building,
  X,
  Download,
} from 'lucide-react'
import { exportCustomersToCSV } from '@/lib/export'
import { exportCompaniesToExcel } from '@/lib/excelExport'
import { validateRequired, validateEmail, validatePhone, validateTaxNumber } from '@/lib/validation'
import type { Database } from '@/types/database'
import { getErrorMessage } from '@/utils/error'
import Tooltip from '@/components/Tooltip'

type CompanyType = 'customer' | 'supplier' | 'both'
type CurrencyCode = 'TRY' | 'USD' | 'EUR' | 'GBP'
type Company = Database['public']['Tables']['companies']['Row']
type CompanyInsert = Database['public']['Tables']['companies']['Insert']

interface CompanyFormData {
  name: string
  email: string
  phone: string
  tax_number: string
  tax_office: string
  address: string
  type: CompanyType
  currency: CurrencyCode
}

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Form state
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    email: '',
    phone: '',
    tax_number: '',
    tax_office: '',
    address: '',
    type: 'customer',
    currency: 'TRY',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Fetch companies
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', searchTerm],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Company[]
    },
    enabled: !!user,
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const normalize = (value: string) => {
        const trimmed = value.trim()
        return trimmed ? trimmed : null
      }

      const basePayload = {
        name: data.name.trim(),
        email: normalize(data.email),
        phone: normalize(data.phone),
        tax_number: normalize(data.tax_number),
        address: normalize(data.address),
        type: data.type,
        currency: data.currency,
      }

      if (editingCompany) {
        if (!user) throw new Error('User not authenticated')
        const { error } = await supabase
          .from('companies')
          .update(basePayload)
          .eq('id', editingCompany.id)
          .eq('user_id', user.id) // Güvenlik: sadece kendi kaydını güncelleyebilsin
        if (error) throw error
      } else {
        if (!user) throw new Error('User not authenticated')
        const insertPayload: CompanyInsert = {
          ...basePayload,
          user_id: user.id,
          balance: 0,
          is_active: true,
        }
        const { error } = await supabase.from('companies').insert([insertPayload])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success(editingCompany ? 'Müşteri güncellendi' : 'Müşteri eklendi')
      handleCloseModal()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!user) throw new Error('User not authenticated')
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id) // Güvenlik: sadece kendi kaydını silebilsin
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Müşteri silindi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleOpenModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company)
      setFormData({
        name: company.name,
        email: company.email || '',
        phone: company.phone || '',
        tax_number: company.tax_number || '',
        tax_office: company.tax_office || '',
        address: company.address || '',
        type: company.type,
        currency: company.currency,
      })
    } else {
      setEditingCompany(null)
      setFormData({
        name: '',
        email: '',
        phone: '',
        tax_number: '',
        tax_office: '',
        address: '',
        type: 'customer',
        currency: 'TRY',
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingCompany(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      tax_number: '',
      tax_office: '',
      address: '',
      type: 'customer',
      currency: 'TRY',
    })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validate name (required)
    const nameValidation = validateRequired(formData.name, 'Müşteri adı')
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error!
    }

    // Validate email (optional but must be valid format)
    if (formData.email) {
      const emailValidation = validateEmail(formData.email)
      if (!emailValidation.isValid) {
        errors.email = emailValidation.error!
      }
    }

    // Validate phone (optional but must be valid format)
    if (formData.phone) {
      const phoneValidation = validatePhone(formData.phone)
      if (!phoneValidation.isValid) {
        errors.phone = phoneValidation.error!
      }
    }

    // Validate tax number (optional but must be valid format)
    if (formData.tax_number) {
      const taxValidation = validateTaxNumber(formData.tax_number)
      if (!taxValidation.isValid) {
        errors.tax_number = taxValidation.error!
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFieldBlur = (field: string) => {
    setTouched({ ...touched, [field]: true })

    // Validate single field
    const errors: Record<string, string> = { ...formErrors }

    if (field === 'name') {
      const validation = validateRequired(formData.name, 'Müşteri adı')
      if (!validation.isValid) {
        errors.name = validation.error!
      } else {
        delete errors.name
      }
    }

    if (field === 'email' && formData.email) {
      const validation = validateEmail(formData.email)
      if (!validation.isValid) {
        errors.email = validation.error!
      } else {
        delete errors.email
      }
    }

    if (field === 'phone' && formData.phone) {
      const validation = validatePhone(formData.phone)
      if (!validation.isValid) {
        errors.phone = validation.error!
      } else {
        delete errors.phone
      }
    }

    if (field === 'tax_number' && formData.tax_number) {
      const validation = validateTaxNumber(formData.tax_number)
      if (!validation.isValid) {
        errors.tax_number = validation.error!
      } else {
        delete errors.tax_number
      }
    }

    setFormErrors(errors)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Mark all fields as touched
    setTouched({
      name: true,
      email: true,
      phone: true,
      tax_number: true,
    })

    if (validateForm()) {
      saveMutation.mutate(formData)
    } else {
      toast.error('Lütfen form hatalarını düzeltin')
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleExportCSV = () => {
    if (!companies || companies.length === 0) {
      toast.error('Dışa aktarılacak müşteri bulunamadı')
      return
    }
    exportCustomersToCSV(companies)
    toast.success('Müşteriler CSV olarak dışa aktarıldı')
  }

  const handleExportExcel = () => {
    if (!companies || companies.length === 0) {
      toast.error('Dışa aktarılacak müşteri bulunamadı')
      return
    }
    exportCompaniesToExcel(companies)
    toast.success('Müşteriler Excel olarak dışa aktarıldı')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Müşteriler
            </h1>
            <Tooltip content="Müşteri ve tedarikçi bilgilerini ekleyin, düzenleyin. İletişim detayları, vergi bilgileri ve ödeme koşullarını yönetin. CSV/Excel dışa aktarın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Müşterilerinizi yönetin
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            CSV
          </button>
          <button onClick={handleExportExcel} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            Excel
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Yeni Müşteri
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Companies List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies?.map((company) => (
            <div key={company.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {company.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenModal(company)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {company.name}
              </h3>

              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300 text-xs font-medium mb-3">
                {company.type === 'customer'
                  ? 'Müşteri'
                  : company.type === 'supplier'
                  ? 'Tedarikçi'
                  : 'Müşteri/Tedarikçi'}
                <span className="h-3 w-px bg-primary-200 dark:bg-primary-800" aria-hidden="true"></span>
                {company.currency}
              </span>

              <div className="space-y-2">
                {company.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{company.email}</span>
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    <span>{company.phone}</span>
                  </div>
                )}
                {company.tax_number && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Building className="w-4 h-4" />
                    <span>{company.tax_number}</span>
                  </div>
                )}
                {company.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Adres:</span>
                    <span className="line-clamp-3">{company.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {companies?.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                Henüz müşteri bulunmuyor
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingCompany ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Müşteri Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  onBlur={() => handleFieldBlur('name')}
                  className={`input-field ${
                    touched.name && formErrors.name ? 'border-red-500 dark:border-red-400' : ''
                  }`}
                  placeholder="Örn: Ahmet Yılmaz"
                />
                {touched.name && formErrors.name && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  onBlur={() => handleFieldBlur('email')}
                  className={`input-field ${
                    touched.email && formErrors.email ? 'border-red-500 dark:border-red-400' : ''
                  }`}
                  placeholder="ornek@email.com"
                />
                {touched.email && formErrors.email && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  onBlur={() => handleFieldBlur('phone')}
                  className={`input-field ${
                    touched.phone && formErrors.phone ? 'border-red-500 dark:border-red-400' : ''
                  }`}
                  placeholder="0555 123 45 67 veya +44 20 7123 4567"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Uluslararası format için ülke kodunu başına ekleyin (örn: +49 ...).
                </p>
                {touched.phone && formErrors.phone && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {formErrors.phone}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vergi Kimlik No (VKN)
                  </label>
                  <input
                    type="text"
                    value={formData.tax_number}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_number: e.target.value })
                    }
                    className="input-field"
                    placeholder="1234567890"
                    maxLength={10}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    E-Fatura için gerekli
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vergi Dairesi
                  </label>
                  <input
                    type="text"
                    value={formData.tax_office}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_office: e.target.value })
                    }
                    className="input-field"
                    placeholder="Kadıköy"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tür *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as CompanyType,
                      })
                    }
                    className="input-field"
                  >
                    <option value="customer">Müşteri</option>
                    <option value="supplier">Tedarikçi</option>
                    <option value="both">Müşteri / Tedarikçi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Para Birimi *
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currency: e.target.value as CurrencyCode,
                      })
                    }
                    className="input-field"
                  >
                    <option value="TRY">TRY</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adres
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="input-field"
                  rows={3}
                  placeholder="Tam adres..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending
                    ? 'Kaydediliyor...'
                    : editingCompany
                    ? 'Güncelle'
                    : 'Ekle'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
