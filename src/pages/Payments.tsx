import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { createPaymentJournalEntry } from '@/lib/journalEntryHelper'
import {
  Plus,
  Search,
  Calendar,
  CreditCard,
  Banknote,
  CheckCircle,
  Trash2,
  X,
  FileText,
  DollarSign,
} from 'lucide-react'
import Tooltip from '@/components/Tooltip'

type PaymentMethod = 'cash' | 'bank_transfer' | 'credit_card' | 'check' | 'other'

interface Payment {
  id: number
  invoice_id: number
  payment_date: string
  amount: number
  payment_method: PaymentMethod
  reference_number: string | null
  notes: string | null
  invoices: {
    invoice_number: string
    total_amount: number
    companies: {
      name: string
    } | null
  } | null
}

interface Invoice {
  id: number
  invoice_number: string
  total_amount: number
  paid_amount?: number
  remaining_amount?: number
  companies: {
    name: string
  } | null
}

export default function Payments() {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')

  // Fetch payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, invoices(id, invoice_number, total_amount, company_id, companies(name))')
        .order('payment_date', { ascending: false })

      if (searchTerm) {
        query = query.or(
          `reference_number.ilike.%${searchTerm}%,invoices.invoice_number.ilike.%${searchTerm}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data as Payment[]
    },
  })

  // Fetch unpaid/partially paid invoices for dropdown
  const { data: invoices } = useQuery({
    queryKey: ['unpaid-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_number, total_amount, companies(name)')
        .in('status', ['sent', 'draft'])
        .order('invoice_date', { ascending: false })

      if (error) throw error

      // Get paid amounts for each invoice
      const invoicesWithPayments = await Promise.all(
        (data as Invoice[]).map(async (invoice) => {
          const { data: paidData } = await supabase.rpc('get_invoice_paid_amount', {
            invoice_id_param: invoice.id,
          })

          const paidAmount = paidData || 0
          return {
            ...invoice,
            paid_amount: paidAmount,
            remaining_amount: invoice.total_amount - paidAmount,
          }
        })
      )

      return invoicesWithPayments.filter((inv) => inv.remaining_amount > 0)
    },
  })

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      if (!selectedInvoiceId) throw new Error('Fatura seçilmedi')
      if (!amount || parseFloat(amount) <= 0) throw new Error('Geçerli bir tutar giriniz')

      const selectedInvoice = invoices?.find((inv) => inv.id === selectedInvoiceId)
      if (
        selectedInvoice &&
        parseFloat(amount) > (selectedInvoice.remaining_amount || 0)
      ) {
        throw new Error('Ödeme tutarı kalan tutardan fazla olamaz')
      }

      const { data, error } = await supabase
        .from('payments')
        .insert([
          {
            user_id: user.id,
            invoice_id: selectedInvoiceId,
            payment_date: paymentDate,
            amount: parseFloat(amount),
            payment_method: paymentMethod,
            reference_number: referenceNumber || null,
            notes: notes || null,
          },
        ])
        .select()

      if (error) throw error

      // Otomatik yevmiye kaydı oluştur
      if (selectedInvoice && user) {
        try {
          await createPaymentJournalEntry(
            user.id,
            data[0].id,
            paymentDate,
            selectedInvoice.companies?.name || 'Müşteri',
            parseFloat(amount),
            paymentMethod as 'cash' | 'bank' | 'credit_card'
          )
        } catch (journalError) {
          console.error('Yevmiye kaydı oluşturulamadı:', journalError)
          toast.error('Uyarı: Yevmiye kaydı oluşturulamadı. Hesap planınızı kontrol edin.')
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Ödeme kaydedildi')
      handleCloseModal()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['unpaid-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Ödeme silindi')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createPaymentMutation.mutate()
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedInvoiceId(null)
    setAmount('')
    setPaymentMethod('bank_transfer')
    setReferenceNumber('')
    setNotes('')
    setPaymentDate(new Date().toISOString().split('T')[0])
  }

  const handleDelete = (id: number) => {
    if (confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) {
      deletePaymentMutation.mutate(id)
    }
  }

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return <Banknote className="w-4 h-4" />
      case 'bank_transfer':
        return <DollarSign className="w-4 h-4" />
      case 'credit_card':
        return <CreditCard className="w-4 h-4" />
      case 'check':
        return <FileText className="w-4 h-4" />
      default:
        return <DollarSign className="w-4 h-4" />
    }
  }

  const getPaymentMethodLabel = (method: PaymentMethod) => {
    const labels: Record<PaymentMethod, string> = {
      cash: 'Nakit',
      bank_transfer: 'Banka Transferi',
      credit_card: 'Kredi Kartı',
      check: 'Çek',
      other: 'Diğer',
    }
    return labels[method]
  }

  const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Ödemeler</h1>
            <Tooltip content="Fatura ödemelerini kaydedin, ödeme yöntemlerini belirtin. Kısmi veya tam ödeme takibi yapın. Fatura bakiyelerini görüntüleyin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Fatura ödemelerini yönetin
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-5 h-5" />
          Ödeme Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Ödeme</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {payments?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Tutar</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                ₺{totalPayments.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ödeme Bekleyen Fatura
              </p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {invoices?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Fatura no veya referans no ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tarih
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Fatura
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Müşteri
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Ödeme Yöntemi
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Referans
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tutar (₺)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments && payments.length > 0 ? (
                  payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(payment.payment_date).toLocaleDateString('tr-TR')}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {payment.invoices?.invoice_number || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-700 dark:text-gray-300">
                          {payment.invoices?.companies?.name || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.payment_method)}
                          <span className="text-gray-700 dark:text-gray-300">
                            {getPaymentMethodLabel(payment.payment_method)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-600 dark:text-gray-400">
                          {payment.reference_number || '—'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          ₺{payment.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleDelete(payment.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-400">Henüz ödeme kaydı yok</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Yeni Ödeme Ekle
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Invoice Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fatura *
                  </label>
                  <select
                    value={selectedInvoiceId || ''}
                    onChange={(e) => {
                      const invoiceId = Number(e.target.value)
                      setSelectedInvoiceId(invoiceId)
                      const invoice = invoices?.find((inv) => inv.id === invoiceId)
                      if (invoice) {
                        setAmount(invoice.remaining_amount?.toString() || '')
                      }
                    }}
                    className="input-field"
                    required
                  >
                    <option value="">Fatura Seçiniz</option>
                    {invoices?.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.companies?.name} (Kalan: ₺
                        {invoice.remaining_amount?.toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ödeme Tarihi *
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tutar (₺) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-field"
                    required
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ödeme Yöntemi *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="input-field"
                    required
                  >
                    <option value="bank_transfer">Banka Transferi</option>
                    <option value="cash">Nakit</option>
                    <option value="credit_card">Kredi Kartı</option>
                    <option value="check">Çek</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Referans No / Dekont No
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="İşlem referans numarası"
                    className="input-field"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notlar
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ödeme ile ilgili notlar..."
                    rows={3}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={createPaymentMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createPaymentMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
