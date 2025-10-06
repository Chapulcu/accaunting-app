import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Plus, Play, Pause, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

type RecurrenceInterval = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type RecurringStatus = 'active' | 'paused' | 'completed' | 'cancelled'

interface RecurringInvoice {
  id: string
  company_id: number
  interval_type: RecurrenceInterval
  interval_count: number
  start_date: string
  end_date: string | null
  next_invoice_date: string
  notes: string | null
  status: RecurringStatus
  total_generated: number
  last_generated_at: string | null
  created_at: string
  companies: {
    name: string
  }
}

interface RecurringInvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_rate: number
}

interface Company {
  id: number
  name: string
}

const intervalLabels: Record<RecurrenceInterval, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  quarterly: 'Üç Aylık',
  yearly: 'Yıllık',
}

const statusLabels: Record<RecurringStatus, string> = {
  active: 'Aktif',
  paused: 'Durduruldu',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
}

const statusColors: Record<RecurringStatus, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function RecurringInvoices() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [intervalType, setIntervalType] = useState<RecurrenceInterval>('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Omit<RecurringInvoiceItem, 'id'>[]>([])

  // Fetch recurring invoices
  const { data: recurringInvoices, isLoading } = useQuery({
    queryKey: ['recurring-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select('*, companies(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as RecurringInvoice[]
    },
  })

  // Fetch companies
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data as Company[]
    },
  })

  // Create recurring invoice mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      if (selectedCompanyId === null) throw new Error('Müşteri seçilmedi')
      if (items.length === 0) throw new Error('En az bir kalem eklenmelidir')

      // Calculate next invoice date
      const nextDate = new Date(startDate)

      // Insert recurring invoice
      const { data: recurringInvoice, error: invoiceError } = await supabase
        .from('recurring_invoices')
        .insert({
          user_id: user.id,
          company_id: selectedCompanyId,
          interval_type: intervalType,
          interval_count: intervalCount,
          start_date: startDate,
          end_date: endDate || null,
          next_invoice_date: nextDate.toISOString().split('T')[0],
          notes: notes || null,
          status: 'active',
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Insert items
      const itemsToInsert = items.map((item) => ({
        recurring_invoice_id: recurringInvoice.id,
        ...item,
      }))

      const { error: itemsError } = await supabase
        .from('recurring_invoice_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return recurringInvoice
    },
    onSuccess: () => {
      toast.success('Tekrarlayan fatura oluşturuldu')
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Hata oluştu')
    },
  })

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RecurringStatus }) => {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({ status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] })
      toast.success('Durum güncellendi')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Hata oluştu')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('recurring_invoices')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] })
      toast.success('Tekrarlayan fatura silindi')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Hata oluştu')
    },
  })

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedCompanyId(null)
    setIntervalType('monthly')
    setIntervalCount(1)
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setNotes('')
    setItems([])
  }

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 20,
        discount_rate: 0,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (
    index: number,
    field: keyof Omit<RecurringInvoiceItem, 'id'>,
    value: string | number
  ) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleToggleStatus = (id: string, currentStatus: RecurringStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    updateStatusMutation.mutate({ id, status: newStatus })
  }

  const handleDelete = (id: string) => {
    if (confirm('Tekrarlayan faturayı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Tekrarlayan Faturalar</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Yeni Tekrarlayan Fatura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Toplam</div>
          <div className="text-2xl font-bold text-gray-900">
            {recurringInvoices?.length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Aktif</div>
          <div className="text-2xl font-bold text-green-600">
            {recurringInvoices?.filter((r) => r.status === 'active').length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Durduruldu</div>
          <div className="text-2xl font-bold text-yellow-600">
            {recurringInvoices?.filter((r) => r.status === 'paused').length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-500">Oluşturulan Faturalar</div>
          <div className="text-2xl font-bold text-blue-600">
            {recurringInvoices?.reduce((sum, r) => sum + r.total_generated, 0) || 0}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Müşteri
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Periyot
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sonraki Fatura
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Oluşturulan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Durum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recurringInvoices?.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {invoice.companies.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {invoice.interval_count > 1
                      ? `${invoice.interval_count} `
                      : ''}
                    {intervalLabels[invoice.interval_type]}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(invoice.next_invoice_date).toLocaleDateString('tr-TR')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{invoice.total_generated}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      statusColors[invoice.status]
                    }`}
                  >
                    {statusLabels[invoice.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    {(invoice.status === 'active' || invoice.status === 'paused') && (
                      <button
                        onClick={() => handleToggleStatus(invoice.id, invoice.status)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title={
                          invoice.status === 'active' ? 'Duraklat' : 'Aktifleştir'
                        }
                      >
                        {invoice.status === 'active' ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Sil"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!recurringInvoices || recurringInvoices.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            Henüz tekrarlayan fatura yok
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 my-8">
            <h2 className="text-xl font-bold mb-4">Yeni Tekrarlayan Fatura</h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Müşteri *
                </label>
                <select
                  value={selectedCompanyId || ''}
                  onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Seçiniz</option>
                  {companies?.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Interval */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Periyot Tipi *
                  </label>
                  <select
                    value={intervalType}
                    onChange={(e) =>
                      setIntervalType(e.target.value as RecurrenceInterval)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    {Object.entries(intervalLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Her Kaç Periyotta *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={intervalCount}
                    onChange={(e) => setIntervalCount(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Başlangıç Tarihi *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bitiş Tarihi (opsiyonel)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notlar
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Kalemler *
                  </label>
                  <button
                    onClick={handleAddItem}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Kalem Ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-2 items-end border p-2 rounded"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          placeholder="Açıklama"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(index, 'description', e.target.value)
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Miktar"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Birim Fiyat"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'unit_price',
                              Number(e.target.value)
                            )
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          placeholder="KDV%"
                          value={item.tax_rate}
                          onChange={(e) =>
                            handleItemChange(index, 'tax_rate', Number(e.target.value))
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="İskonto%"
                          value={item.discount_rate}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'discount_rate',
                              Number(e.target.value)
                            )
                          }
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                İptal
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {createMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
