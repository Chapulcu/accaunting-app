import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import type { Database } from '@/types/database'
import { getErrorMessage } from '@/utils/error'
import { createExpenseJournalEntry } from '@/lib/journalEntryHelper'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Tag,
  X,
  Download,
  ScanLine,
  FileCheck,
} from 'lucide-react'
import { exportExpensesToExcel } from '@/lib/excelExport'
import Tooltip from '@/components/Tooltip'
import AIInvoiceScanner from '@/components/ai/AIInvoiceScanner'
import BulkOCRProcessor from '@/components/ai/BulkOCRProcessor'

type ExpenseRow = Database['public']['Tables']['expenses']['Row']
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']
type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row']

type Expense = ExpenseRow & {
  expense_categories: {
    name: string
  } | null
}

interface ExpenseFormData {
  description: string
  amount: string
  expense_date: string
  category_id: string
  payment_method: string
}

export default function Expenses() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showOCRScanner, setShowOCRScanner] = useState(false)
  const [showBulkOCR, setShowBulkOCR] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { settings } = useSettings()

  // Form state
  const [formData, setFormData] = useState<ExpenseFormData>({
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    payment_method: 'cash',
  })

  // Fetch expenses
  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .order('expense_date', { ascending: false })

      if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Expense[]
    },
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data as ExpenseCategory[]
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const amountValue = parseFloat(data.amount)
      if (Number.isNaN(amountValue)) {
        throw new Error('Geçerli bir tutar giriniz')
      }

      const expenseData: ExpenseUpdate = {
        description: data.description.trim(),
        amount: amountValue,
        expense_date: data.expense_date,
        category_id: data.category_id ? data.category_id : null,
        payment_method: data.payment_method,
      }

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)
        if (error) throw error
      } else {
        if (!user) throw new Error('User not authenticated')
        const insertPayload: ExpenseInsert = {
          ...expenseData,
          user_id: user.id,
        }
        const { data: insertedExpense, error } = await supabase
          .from('expenses')
          .insert([insertPayload])
          .select()
          .single()
        if (error) throw error

        // Otomatik yevmiye kaydı oluştur (sadece yeni gider için)
        if (insertedExpense && user) {
          try {
            // KDV tutarı hesapla (varsayılan %20)
            const vatRate = 0.20
            const subtotal = amountValue / (1 + vatRate)
            const vatAmount = amountValue - subtotal

            // Kategori bilgisini al
            const category = categories?.find(c => c.id === data.category_id)

            await createExpenseJournalEntry(
              user.id,
              insertedExpense.id,
              data.expense_date,
              data.description.trim(),
              amountValue,
              vatAmount,
              category?.name || 'Genel',
              data.payment_method as 'cash' | 'bank' | 'credit_card'
            )
          } catch (journalError) {
            console.error('Yevmiye kaydı oluşturulamadı:', journalError)
            toast.error('Uyarı: Yevmiye kaydı oluşturulamadı. Hesap planınızı kontrol edin.')
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(editingExpense ? 'Gider güncellendi' : 'Gider eklendi')
      handleCloseModal()
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Gider silindi')
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error))
    },
  })

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        description: expense.description,
        amount: expense.amount.toString(),
        expense_date: expense.expense_date,
        category_id: expense.category_id || '',
        payment_method: expense.payment_method,
      })
    } else {
      setEditingExpense(null)
      setFormData({
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        category_id: '',
        payment_method: 'cash',
      })
    }
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingExpense(null)
    setFormData({
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      category_id: '',
      payment_method: 'cash',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(formData)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Bu gideri silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id)
    }
  }

  const getTotalExpenses = () => {
    return expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Giderler
            </h1>
            <Tooltip content="İşletme giderlerinizi kaydedin, kategorilere ayırın. Ödeme yöntemlerini belirtin, makbuz yükleyin. Onay süreçlerini yönetin. Excel'e aktarın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Giderlerinizi yönetin
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => {
            if (!expenses || expenses.length === 0) {
              toast.error('Dışa aktarılacak gider bulunamadı')
              return
            }
            exportExpensesToExcel(expenses)
            toast.success('Giderler Excel olarak dışa aktarıldı')
          }} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            Excel
          </button>
          {settings?.ai_ocr_enabled && (
            <>
              <button
                onClick={() => setShowOCRScanner(true)}
                className="btn-secondary flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <ScanLine className="w-5 h-5" />
                Fiş Tarama
              </button>
              <button
                onClick={() => setShowBulkOCR(true)}
                className="btn-secondary flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              >
                <FileCheck className="w-5 h-5" />
                Toplu OCR
              </button>
            </>
          )}
          <button onClick={() => handleOpenModal()} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Yeni Gider
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Toplam Gider
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            ₺{getTotalExpenses().toLocaleString('tr-TR')}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gider Sayısı
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {expenses?.length || 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kategori Sayısı
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {categories?.length || 0}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Gider ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field !pl-10"
          />
        </div>
      </div>

      {/* Expenses List */}
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
                    Açıklama
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Kategori
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tarih
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Ödeme Yöntemi
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tutar
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {expense.description}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {expense.expense_categories && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {expense.expense_categories.name}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(expense.expense_date).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">
                        {expense.payment_method === 'cash'
                          ? 'Nakit'
                          : expense.payment_method === 'card'
                          ? 'Kart'
                          : expense.payment_method === 'bank_transfer'
                          ? 'Havale'
                          : expense.payment_method}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        ₺{expense.amount.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(expense)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {expenses?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Henüz gider bulunmuyor
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingExpense ? 'Gider Düzenle' : 'Yeni Gider'}
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
                  Açıklama *
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="input-field"
                  placeholder="Örn: Ofis malzemeleri"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tutar (₺) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none font-semibold">₺</span>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="input-field !pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tarih *
                </label>
                <input
                  type="date"
                  required
                  value={formData.expense_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expense_date: e.target.value })
                  }
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Kategori
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({ ...formData, category_id: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="">Kategori seçin</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ödeme Yöntemi *
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData({ ...formData, payment_method: e.target.value })
                  }
                  className="input-field"
                >
                  <option value="cash">Nakit</option>
                  <option value="card">Kart</option>
                  <option value="bank_transfer">Havale</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMutation.isPending
                    ? 'Kaydediliyor...'
                    : editingExpense
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

      {/* OCR Scanner Modal */}
      {showOCRScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ScanLine className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                AI Fiş/Fatura Tarama
              </h2>
              <button
                onClick={() => setShowOCRScanner(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <AIInvoiceScanner
                onScanComplete={async (result) => {
                  // Auto-fill form with OCR data
                  const newFormData: Partial<ExpenseFormData> = {}

                  if (result.vendor_name) {
                    newFormData.description = `${result.vendor_name} - ${result.document_number || 'Gider'}`
                  }

                  if (result.total_amount) {
                    newFormData.amount = result.total_amount.toString()
                  }

                  if (result.document_date) {
                    // Parse date (format might be DD/MM/YYYY or YYYY-MM-DD)
                    try {
                      const date = new Date(result.document_date)
                      if (!isNaN(date.getTime())) {
                        newFormData.expense_date = date.toISOString().split('T')[0]
                      }
                    } catch (e) {
                      // Use today's date as fallback
                      newFormData.expense_date = new Date().toISOString().split('T')[0]
                    }
                  } else {
                    newFormData.expense_date = new Date().toISOString().split('T')[0]
                  }

                  // Try to get AI categorization suggestion
                  if (settings?.ai_categorization_enabled && result.vendor_name) {
                    try {
                      const { data: categoryData } = await supabase.functions.invoke(
                        'ai-categorization',
                        {
                          body: {
                            entity_type: 'expense',
                            description: result.vendor_name,
                            amount: result.total_amount,
                          },
                        }
                      )

                      if (categoryData?.suggested_category_id) {
                        newFormData.category_id = categoryData.suggested_category_id.toString()
                        toast.success(
                          `AI Kategori Önerisi: ${categoryData.suggested_category_name || 'Bilinmeyen'}`,
                          { duration: 5000 }
                        )
                      }
                    } catch (error) {
                      console.error('AI categorization error:', error)
                      // Continue without category suggestion
                    }
                  }

                  // Update form data
                  setFormData((prev) => ({
                    ...prev,
                    ...newFormData,
                    payment_method: prev.payment_method || 'cash',
                    category_id: newFormData.category_id || prev.category_id || '',
                  }))

                  // Close OCR modal and open expense form modal
                  setShowOCRScanner(false)
                  setShowModal(true)
                  setEditingExpense(null)

                  toast.success(
                    'OCR verisi form\'a aktarıldı! Kontrol edip kaydedin.',
                    { duration: 4000 }
                  )
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk OCR Processor Modal */}
      {showBulkOCR && (
        <BulkOCRProcessor
          entityType="expense"
          onClose={() => setShowBulkOCR(false)}
          onBulkComplete={async (results) => {
            // Show confirmation dialog
            const confirmMessage = `${results.length} gider fişi başarıyla tarandı. Bu giderleri tek tek oluşturmak için tıklayın.`

            if (window.confirm(confirmMessage)) {
              // Process each result
              for (let i = 0; i < results.length; i++) {
                const { result } = results[i]

                // Prepare form data
                const newFormData: Partial<ExpenseFormData> = {}

                if (result.vendor_name) {
                  newFormData.description = `${result.vendor_name} - ${result.document_number || 'Gider'} [Toplu OCR #${i + 1}]`
                }

                if (result.total_amount) {
                  newFormData.amount = result.total_amount.toString()
                }

                if (result.document_date) {
                  try {
                    const date = new Date(result.document_date)
                    if (!isNaN(date.getTime())) {
                      newFormData.expense_date = date.toISOString().split('T')[0]
                    }
                  } catch (e) {
                    newFormData.expense_date = new Date().toISOString().split('T')[0]
                  }
                } else {
                  newFormData.expense_date = new Date().toISOString().split('T')[0]
                }

                // Try to get AI categorization suggestion
                if (settings?.ai_categorization_enabled && result.vendor_name) {
                  try {
                    const { data: categoryData } = await supabase.functions.invoke(
                      'ai-categorization',
                      {
                        body: {
                          entity_type: 'expense',
                          description: result.vendor_name,
                          amount: result.total_amount,
                        },
                      }
                    )

                    if (categoryData?.suggested_category_id) {
                      newFormData.category_id = categoryData.suggested_category_id.toString()
                    }
                  } catch (error) {
                    console.error('AI categorization error:', error)
                  }
                }

                // Update form data for first expense and open modal
                if (i === 0) {
                  setFormData((prev) => ({
                    ...prev,
                    ...newFormData,
                    payment_method: prev.payment_method || 'cash',
                    category_id: newFormData.category_id || prev.category_id || '',
                  }))
                  setShowModal(true)
                  setEditingExpense(null)
                }

                // For subsequent expenses, you could auto-create them or queue them
                // For now, we'll just prepare the first one for manual review
              }

              toast.success(
                `${results.length} gider hazır! İlk gideri kontrol edip kaydedin, sonra diğerlerine geçebilirsiniz.`,
                { duration: 6000 }
              )
            }

            setShowBulkOCR(false)
          }}
        />
      )}
    </div>
  )
}
