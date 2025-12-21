import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Eye,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  X,
  Send,
  Ban,
  Download,
  Printer,
  FileDown,
  FileCheck,
  ScanLine,
} from 'lucide-react'
import { getErrorMessage } from '@/utils/error'
import AIInvoiceScanner from '@/components/ai/AIInvoiceScanner'
import BulkOCRProcessor from '@/components/ai/BulkOCRProcessor'
import { exportInvoicesToCSV } from '@/lib/export'
import { exportInvoicesToExcel } from '@/lib/excelExport'
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/pdf'
import { createInvoiceJournalEntry } from '@/lib/journalEntryHelper'
import Pagination from '@/components/Pagination'
import Tooltip from '@/components/Tooltip'
import { EInvoiceService } from '@/services/eInvoiceService'
import type { EInvoiceParty } from '@/services/eInvoiceService'

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'
type DisplayStatus = InvoiceStatus | 'overdue'

interface Invoice {
  id: number
  invoice_number: string
  company_id: number | null
  invoice_date: string
  due_date: string | null
  status: InvoiceStatus
  subtotal: number
  tax_amount: number
  total_amount: number
  companies: {
    name: string | null
  } | null
}

interface Company {
  id: number
  name: string
}

type InvoiceItemRow = {
  id: number
  invoice_id: number
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  tax_amount: number
  discount_rate: number
  discount_amount: number
  total: number
  created_at: string
  updated_at: string
}

interface InvoiceFormItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  tax_rate: number
  discount_rate: number
}

export default function Invoices() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const queryClient = useQueryClient()

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEInvoiceModal, setShowEInvoiceModal] = useState(false)
  const [showOCRScanner, setShowOCRScanner] = useState(false)
  const [showBulkOCR, setShowBulkOCR] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null)
  const [eInvoiceBuyerVKN, setEInvoiceBuyerVKN] = useState('')
  const [eInvoiceBuyerTitle, setEInvoiceBuyerTitle] = useState('')
  const [eInvoiceBuyerTaxOffice, setEInvoiceBuyerTaxOffice] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<InvoiceFormItem[]>([
    {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 20,
      discount_rate: 0,
    },
  ])

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', searchTerm, statusFilter],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      let query = supabase
        .from('invoices')
        .select('*, companies(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (searchTerm) {
        query = query.ilike('invoice_number', `%${searchTerm}%`)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Invoice[]
    },
    enabled: !!user,
  })

  // Fetch invoice details with items
  const { data: invoiceDetails } = useQuery<InvoiceItemRow[] | null>({
    queryKey: ['invoice-details', selectedInvoice?.id],
    enabled: !!selectedInvoice?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data as InvoiceItemRow[]) || null
    },
  })

  // Fetch companies
  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('type', ['customer', 'both'])
        .order('name')

      if (error) throw error
      return data as Company[]
    },
    enabled: !!user,
  })

  // Fetch company settings for PDF generation
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    },
    enabled: !!user,
  })

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      if (selectedCompanyId === null) throw new Error('Müşteri seçilmedi')
      if (items.length === 0) throw new Error('En az bir kalem eklenmelidir')

      // Validate items
      for (const item of items) {
        if (!item.description.trim()) {
          throw new Error('Tüm kalemlerin açıklaması olmalıdır')
        }
        if (item.quantity <= 0 || item.unit_price < 0) {
          throw new Error('Geçersiz miktar veya birim fiyat')
        }
      }

      // Calculate totals
      let invoiceSubtotal = 0
      let invoiceTaxAmount = 0
      let invoiceTotal = 0

      const itemsWithTotals = items.map((item) => {
        const discountAmount =
          item.quantity * item.unit_price * (item.discount_rate / 100)
        const subtotal = item.quantity * item.unit_price - discountAmount
        const taxAmount = subtotal * (item.tax_rate / 100)
        const total = subtotal + taxAmount

        invoiceSubtotal += subtotal
        invoiceTaxAmount += taxAmount
        invoiceTotal += total

        return {
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          discount_rate: item.discount_rate,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total: total,
        }
      })

      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`

      // Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          company_id: selectedCompanyId,
          invoice_type: 'sales',
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || invoiceDate,
          status: 'draft',
          subtotal: invoiceSubtotal,
          tax_amount: invoiceTaxAmount,
          total_amount: invoiceTotal,
          notes: notes || null,
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Insert invoice items
      const itemsToInsert = itemsWithTotals.map((item) => ({
        invoice_id: invoice.id,
        ...item,
      }))

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      return invoice // Return invoice for auto e-invoice sending
    },
    onSuccess: async (invoice) => {
      toast.success('Fatura başarıyla oluşturuldu')
      handleCloseModal()
      queryClient.invalidateQueries({ queryKey: ['invoices'] })

      // Otomatik e-fatura gönderimi kontrolü
      if (user) {
        try {
          const { data: settings } = await supabase
            .from('e_invoice_settings')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (settings?.is_active && settings?.auto_send) {
            // Müşteri bilgilerini çek
            const { data: company } = await supabase
              .from('companies')
              .select('*')
              .eq('id', invoice.company_id)
              .single()

            if (company && company.tax_number) {
              // E-Fatura gönder
              const buyerInfo = {
                vkn: company.tax_number,
                title: company.name,
                taxOffice: company.tax_office || undefined,
              }

              const response = await EInvoiceService.createFromInvoice(
                user.id,
                invoice.id,
                buyerInfo
              )

              if (response.success) {
                toast.success('E-Fatura otomatik olarak gönderildi!')
                queryClient.invalidateQueries({ queryKey: ['e-invoices'] })
              }
            }
          }
        } catch (error) {
          console.error('Auto e-invoice send error:', error)
          // Hatayı sessizce logla, ana işlemi engelleme
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Fatura oluşturulurken hata oluştu')
    },
  })

  // Update invoice status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: InvoiceStatus }) => {
      const { error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id)
      if (error) throw error

      // Eğer status 'sent' ise otomatik yevmiye kaydı oluştur
      if (status === 'sent' && user) {
        // Fatura bilgilerini çek
        const { data: invoice } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_date,
            subtotal,
            tax_amount,
            total_amount,
            companies:company_id (name)
          `)
          .eq('id', id)
          .single()

        if (invoice && invoice.companies) {
          try {
            await createInvoiceJournalEntry(
              user.id,
              invoice.id,
              invoice.invoice_date,
              invoice.companies.name || 'Müşteri',
              invoice.subtotal,
              invoice.tax_amount,
              invoice.total_amount
            )
          } catch (error) {
            console.error('Yevmiye kaydı oluşturulamadı:', error)
            // Hata varsa kullanıcıya bildir ama fatura durumunu güncellemeye devam et
            toast.error('Uyarı: Yevmiye kaydı oluşturulamadı. Hesap planınızı kontrol edin.')
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      toast.success('Fatura durumu güncellendi')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Durum güncellenirken hata oluştu')
    },
  })

  const handleStatusChange = (id: number, status: InvoiceStatus) => {
    updateStatusMutation.mutate({ id, status })
  }

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowDetailModal(true)
  }

  const handleCloseDetailModal = () => {
    setShowDetailModal(false)
    setSelectedInvoice(null)
  }

  const handleDownloadPDF = async () => {
    if (!selectedInvoice) return

    try {
      // Fetch full invoice details with items and company info
      const { data: fullInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, companies(name, tax_number, address, phone, email)')
        .eq('id', selectedInvoice.id)
        .single()

      if (invoiceError) throw invoiceError

      // Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice.id)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      // Prepare invoice data for PDF
      const invoiceData = {
        ...fullInvoice,
        invoice_items: items,
      }

      await downloadInvoicePDF(invoiceData, companySettings)
      toast.success('PDF indirildi')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'PDF indirilemedi'))
    }
  }

  const handlePrintPDF = async () => {
    if (!selectedInvoice) return

    try {
      // Fetch full invoice details with items and company info
      const { data: fullInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, companies(name, tax_number, address, phone, email)')
        .eq('id', selectedInvoice.id)
        .single()

      if (invoiceError) throw invoiceError

      // Fetch invoice items
      const { data: items, error: itemsError } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', selectedInvoice.id)
        .order('created_at', { ascending: true })

      if (itemsError) throw itemsError

      // Prepare invoice data for PDF
      const invoiceData = {
        ...fullInvoice,
        invoice_items: items,
      }

      await printInvoicePDF(invoiceData, companySettings)
      toast.success('Yazdırma penceresi açıldı')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Yazdırılamadı'))
    }
  }

  const handleExportCSV = () => {
    if (!invoices || invoices.length === 0) {
      toast.error('Dışa aktarılacak fatura bulunamadı')
      return
    }
    exportInvoicesToCSV(invoices)
    toast.success('Faturalar CSV olarak dışa aktarıldı')
  }

  const handleExportExcel = () => {
    if (!invoices || invoices.length === 0) {
      toast.error('Dışa aktarılacak fatura bulunamadı')
      return
    }
    exportInvoicesToExcel(invoices)
    toast.success('Faturalar Excel olarak dışa aktarıldı')
  }

  const handleOpenEInvoiceModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setShowEInvoiceModal(true)
    // Pre-fill buyer info if available
    setEInvoiceBuyerTitle(invoice.companies?.name || '')
  }

  const handleCloseEInvoiceModal = () => {
    setShowEInvoiceModal(false)
    setSelectedInvoice(null)
    setEInvoiceBuyerVKN('')
    setEInvoiceBuyerTitle('')
    setEInvoiceBuyerTaxOffice('')
  }

  const sendEInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedInvoice) throw new Error('Missing required data')

      const buyerInfo: EInvoiceParty = {
        vkn: eInvoiceBuyerVKN,
        title: eInvoiceBuyerTitle,
        taxOffice: eInvoiceBuyerTaxOffice,
      }

      return await EInvoiceService.createFromInvoice(
        user.id,
        selectedInvoice.id,
        buyerInfo
      )
    },
    onSuccess: (response) => {
      if (response.success) {
        toast.success('E-Fatura başarıyla gönderildi!')
        queryClient.invalidateQueries({ queryKey: ['invoices'] })
        queryClient.invalidateQueries({ queryKey: ['e-invoices'] })
        handleCloseEInvoiceModal()
      } else {
        toast.error(response.error || 'E-Fatura gönderilemedi')
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'E-Fatura gönderimi başarısız')
    },
  })

  const handleSendEInvoice = () => {
    if (!eInvoiceBuyerVKN || !eInvoiceBuyerTitle) {
      toast.error('Lütfen alıcı VKN ve ünvan bilgilerini girin')
      return
    }
    sendEInvoiceMutation.mutate()
  }

  // Item management functions
  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 20,
        discount_rate: 0,
      },
    ])
  }

  const removeItem = (id: string) => {
    if (items.length === 1) {
      toast.error('En az bir kalem olmalıdır')
      return
    }
    setItems(items.filter((item) => item.id !== id))
  }

  const updateItem = <K extends keyof InvoiceFormItem>(
    id: string,
    field: K,
    value: InvoiceFormItem[K]
  ) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  const calculateItemTotal = (item: InvoiceFormItem) => {
    const discountAmount =
      item.quantity * item.unit_price * (item.discount_rate / 100)
    const subtotal = item.quantity * item.unit_price - discountAmount
    const taxAmount = subtotal * (item.tax_rate / 100)
    const total = subtotal + taxAmount
    return total
  }

  // Calculate invoice totals
  const calculateInvoiceTotals = () => {
    let subtotal = 0
    let taxAmount = 0
    let total = 0

    items.forEach((item) => {
      const discountAmount =
        item.quantity * item.unit_price * (item.discount_rate / 100)
      const itemSubtotal = item.quantity * item.unit_price - discountAmount
      const itemTaxAmount = itemSubtotal * (item.tax_rate / 100)

      subtotal += itemSubtotal
      taxAmount += itemTaxAmount
      total += itemSubtotal + itemTaxAmount
    })

    return { subtotal, taxAmount, total }
  }

  const handleOpenModal = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedCompanyId(null)
    setInvoiceDate(new Date().toISOString().split('T')[0])
    setDueDate('')
    setNotes('')
    setItems([
      {
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 20,
        discount_rate: 0,
      },
    ])
  }

  const handleSaveInvoice = () => {
    createInvoiceMutation.mutate()
  }

  const invoiceTotals = calculateInvoiceTotals()

  const getDisplayStatus = (invoice: Invoice): DisplayStatus => {
    if (!invoice.due_date) {
      return invoice.status
    }

    const dueDate = new Date(invoice.due_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    dueDate.setHours(0, 0, 0, 0)

    if (
      invoice.status !== 'paid' &&
      invoice.status !== 'cancelled' &&
      dueDate < today
    ) {
      return 'overdue'
    }

    return invoice.status
  }

  const getStatusBadge = (status: DisplayStatus) => {
    const badges: Record<DisplayStatus, {
      label: string
      className: string
      icon: typeof FileText
    }> = {
      draft: {
        label: 'Taslak',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        icon: FileText,
      },
      sent: {
        label: 'Gönderildi',
        className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        icon: Clock,
      },
      paid: {
        label: 'Ödendi',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        icon: CheckCircle,
      },
      overdue: {
        label: 'Gecikmiş',
        className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        icon: XCircle,
      },
      cancelled: {
        label: 'İptal',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        icon: XCircle,
      },
    }

    const badge = badges[status]
    const Icon = badge.icon

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}
      >
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    )
  }

  // Pagination calculations
  const paginatedInvoices = invoices?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const totalPages = Math.ceil((invoices?.length || 0) / itemsPerPage)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Faturalar
            </h1>
            <Tooltip content="Satış faturalarınızı oluşturun, düzenleyin, gönderin. Durum takibi yapın (taslak, gönderildi, ödendi, iptal). PDF/Excel/CSV dışa aktarın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Faturalarınızı yönetin
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
          {settings?.ai_ocr_enabled && (
            <>
              <button
                onClick={() => setShowOCRScanner(true)}
                className="btn-secondary flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                <ScanLine className="w-5 h-5" />
                OCR Tarama
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
          <button onClick={handleOpenModal} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Yeni Fatura
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Fatura numarası ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field !pl-10"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | InvoiceStatus)
            }
            className="input-field"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="sent">Gönderildi</option>
            <option value="paid">Ödendi</option>
            <option value="cancelled">İptal</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
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
                    Fatura No
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Müşteri
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tarih
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Vade
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tutar (₺)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Durum
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    İşlemler
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices?.map((invoice) => {
                  const displayStatus = getDisplayStatus(invoice)
                  const dueDateLabel = invoice.due_date
                    ? new Date(invoice.due_date).toLocaleDateString('tr-TR')
                    : '-'
                  const invoiceDateLabel = new Date(invoice.invoice_date).toLocaleDateString('tr-TR')

                  return (
                  <tr
                    key={invoice.id}
                    className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {invoice.invoice_number}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-700 dark:text-gray-300">
                        {invoice.companies?.name ?? '—'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {invoiceDateLabel}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-600 dark:text-gray-400">
                        {dueDateLabel}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ₺{invoice.total_amount.toLocaleString('tr-TR')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(displayStatus)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="p-2 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Detayları Görüntüle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(invoice.id, 'sent')}
                          disabled={invoice.status === 'sent' || invoice.status === 'paid'}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Gönder"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(invoice.id, 'paid')}
                          disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
                          className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Ödendi olarak işaretle"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                          disabled={invoice.status === 'cancelled' || invoice.status === 'paid'}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="İptal et"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEInvoiceModal(invoice)}
                          disabled={invoice.status === 'cancelled'}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="E-Fatura Gönder"
                        >
                          <FileCheck className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>

            {invoices?.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  Henüz fatura bulunmuyor
                </p>
              </div>
            )}

            {/* Pagination */}
            {invoices && invoices.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                itemsPerPage={itemsPerPage}
                totalItems={invoices.length}
              />
            )}
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Yeni Fatura
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Customer and Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Müşteri *
                    </label>
                    <select
                      value={selectedCompanyId !== null ? selectedCompanyId.toString() : ''}
                      onChange={(e) =>
                        setSelectedCompanyId(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="input-field"
                      required
                    >
                      <option value="">Müşteri Seçiniz</option>
                      {companies?.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fatura Tarihi *
                    </label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Vade Tarihi
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Fatura Kalemleri
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700">
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                            Açıklama
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white w-24">
                            Miktar
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white w-32">
                            Birim Fiyat (₺)
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white w-24">
                            KDV %
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white w-24">
                            İskonto %
                          </th>
                          <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white w-32">
                            Toplam (₺)
                          </th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100 dark:border-slate-800"
                          >
                            <td className="py-3 px-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(item.id, 'description', e.target.value)
                                }
                                placeholder="Ürün/Hizmet açıklaması"
                                className="input-field w-full"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    'quantity',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                step="0.01"
                                className="input-field w-full"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    'unit_price',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                step="0.01"
                                className="input-field w-full"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.tax_rate}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    'tax_rate',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                max="100"
                                step="1"
                                className="input-field w-full"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.discount_rate}
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    'discount_rate',
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                min="0"
                                max="100"
                                step="1"
                                className="input-field w-full"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <div className="text-gray-900 dark:text-white font-semibold">
                                ₺{calculateItemTotal(item).toFixed(2)}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={addItem}
                    className="mt-4 btn-secondary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Kalem Ekle
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notlar
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Fatura ile ilgili notlarınız..."
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-slate-700 p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Ara Toplam:
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      ₺{invoiceTotals.subtotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      KDV:
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                      ₺{invoiceTotals.taxAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      Genel Toplam:
                    </span>
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      ₺{invoiceTotals.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCloseModal}
                    className="btn-secondary"
                    disabled={createInvoiceMutation.isPending}
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveInvoice}
                    className="btn-primary"
                    disabled={createInvoiceMutation.isPending}
                  >
                    {createInvoiceMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Fatura Detayları
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {selectedInvoice.invoice_number}
                </p>
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Müşteri
                  </h3>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedInvoice.companies?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Durum
                  </h3>
                  {getStatusBadge(
                    getDisplayStatus(selectedInvoice)
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Fatura Tarihi
                  </h3>
                  <p className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(selectedInvoice.invoice_date).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                    Vade Tarihi
                  </h3>
                  <p className="text-gray-900 dark:text-white">
                    {selectedInvoice.due_date
                      ? new Date(selectedInvoice.due_date).toLocaleDateString('tr-TR')
                      : 'Belirtilmemiş'}
                  </p>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Fatura Kalemleri
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Açıklama
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Miktar
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Birim Fiyat
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          KDV %
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          İskonto %
                        </th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-900 dark:text-white">
                          Toplam
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoiceDetails ?? []).map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 dark:border-slate-800"
                        >
                          <td className="py-3 px-2 text-gray-900 dark:text-white">
                            {item.description}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                            ₺{item.unit_price.toLocaleString('tr-TR')}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                            %{item.tax_rate}
                          </td>
                          <td className="py-3 px-2 text-right text-gray-900 dark:text-white">
                            %{item.discount_rate}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white">
                            ₺{item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
                <div className="flex justify-end">
                  <div className="w-full max-w-sm space-y-3">
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>Ara Toplam:</span>
                      <span className="font-semibold">
                        ₺{selectedInvoice.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>KDV:</span>
                      <span className="font-semibold">
                        ₺{selectedInvoice.tax_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-slate-700 pt-3">
                      <span>Genel Toplam:</span>
                      <span>
                        ₺{selectedInvoice.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-slate-700 p-6">
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPDF}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <FileDown className="w-5 h-5" />
                  PDF İndir
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Yazdır
                </button>
                <button
                  onClick={handleCloseDetailModal}
                  className="btn-secondary px-6"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E-Invoice Modal */}
      {showEInvoiceModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                E-Fatura Gönder
              </h2>
              <button
                onClick={handleCloseEInvoiceModal}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>Fatura No:</strong> {selectedInvoice.invoice_number}
                  <br />
                  <strong>Tutar:</strong> ₺{selectedInvoice.total_amount.toLocaleString('tr-TR')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alıcı VKN *
                </label>
                <input
                  type="text"
                  value={eInvoiceBuyerVKN}
                  onChange={(e) => setEInvoiceBuyerVKN(e.target.value)}
                  placeholder="1234567890"
                  maxLength={10}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alıcı Ünvan *
                </label>
                <input
                  type="text"
                  value={eInvoiceBuyerTitle}
                  onChange={(e) => setEInvoiceBuyerTitle(e.target.value)}
                  placeholder="ABC Ticaret Ltd. Şti."
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vergi Dairesi
                </label>
                <input
                  type="text"
                  value={eInvoiceBuyerTaxOffice}
                  onChange={(e) => setEInvoiceBuyerTaxOffice(e.target.value)}
                  placeholder="Kadıköy"
                  className="input-field"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 dark:border-slate-700 p-6">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCloseEInvoiceModal}
                  className="btn-secondary"
                  disabled={sendEInvoiceMutation.isPending}
                >
                  İptal
                </button>
                <button
                  onClick={handleSendEInvoice}
                  className="btn-primary flex items-center gap-2"
                  disabled={sendEInvoiceMutation.isPending}
                >
                  <FileCheck className="w-5 h-5" />
                  {sendEInvoiceMutation.isPending ? 'Gönderiliyor...' : 'E-Fatura Gönder'}
                </button>
              </div>
            </div>
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
                AI Fatura Tarama
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

                  // Set invoice date
                  if (result.document_date) {
                    try {
                      const date = new Date(result.document_date)
                      if (!isNaN(date.getTime())) {
                        setInvoiceDate(date.toISOString().split('T')[0])
                      }
                    } catch (e) {
                      // Keep current date
                    }
                  }

                  // Set notes with vendor info
                  if (result.vendor_name) {
                    const noteText = `Satıcı: ${result.vendor_name}${result.document_number ? ` | Belge No: ${result.document_number}` : ''}`
                    setNotes(noteText)
                  }

                  // Set line items from OCR
                  if (result.items && result.items.length > 0) {
                    const ocrItems: InvoiceFormItem[] = result.items.map((item, index) => ({
                      id: Date.now() + index,
                      description: item.description,
                      quantity: item.quantity || 1,
                      unit_price: item.unit_price || item.amount,
                      tax_rate: 20, // Default tax rate
                      discount_rate: 0,
                    }))
                    setItems(ocrItems)
                    toast.success(`${ocrItems.length} kalem eklendi`, { duration: 3000 })
                  } else if (result.total_amount) {
                    // If no items, create a single item with total amount
                    const singleItem: InvoiceFormItem = {
                      id: Date.now(),
                      description: result.vendor_name || 'OCR Taranan Fatura',
                      quantity: 1,
                      unit_price: result.total_amount / 1.2, // Assuming 20% tax
                      tax_rate: 20,
                      discount_rate: 0,
                    }
                    setItems([singleItem])
                  }

                  // Try to find matching customer by name
                  if (result.vendor_name) {
                    try {
                      const { data: companies } = await supabase
                        .from('companies')
                        .select('id, name')
                        .ilike('name', `%${result.vendor_name}%`)
                        .limit(1)

                      if (companies && companies.length > 0) {
                        setSelectedCompanyId(companies[0].id)
                        toast.success(`Müşteri bulundu: ${companies[0].name}`, { duration: 3000 })
                      } else {
                        toast.info(
                          `Müşteri "${result.vendor_name}" bulunamadı. Yeni müşteri olarak ekleyebilirsiniz.`,
                          { duration: 5000 }
                        )
                      }
                    } catch (error) {
                      console.error('Customer search error:', error)
                    }
                  }

                  // Close OCR modal and open invoice form
                  setShowOCRScanner(false)
                  setShowModal(true)

                  toast.success(
                    'OCR verisi fatura formuna aktarıldı! Kontrol edip kaydedin.',
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
          entityType="invoice"
          onClose={() => setShowBulkOCR(false)}
          onBulkComplete={(results) => {
            // Show confirmation dialog
            const confirmMessage = `${results.length} fatura başarıyla tarandı. Bu faturaları tek tek oluşturmak için tıklayın.`

            if (window.confirm(confirmMessage)) {
              // Process each result
              let processedCount = 0

              results.forEach(async ({ result }, index) => {
                // Wait a bit between each to avoid overwhelming the UI
                setTimeout(async () => {
                  // Reset form
                  setSelectedCompanyId(null)
                  setInvoiceDate(new Date().toISOString().split('T')[0])
                  setNotes('')
                  setItems([])

                  // Set invoice date
                  if (result.document_date) {
                    try {
                      const date = new Date(result.document_date)
                      if (!isNaN(date.getTime())) {
                        setInvoiceDate(date.toISOString().split('T')[0])
                      }
                    } catch (e) {
                      // Keep current date
                    }
                  }

                  // Set notes with vendor info
                  if (result.vendor_name) {
                    const noteText = `Satıcı: ${result.vendor_name}${result.document_number ? ` | Belge No: ${result.document_number}` : ''} [Toplu OCR #${index + 1}]`
                    setNotes(noteText)
                  }

                  // Set line items from OCR
                  if (result.items && result.items.length > 0) {
                    const ocrItems: InvoiceFormItem[] = result.items.map((item, idx) => ({
                      id: Date.now() + idx,
                      description: item.description,
                      quantity: item.quantity || 1,
                      unit_price: item.unit_price || item.amount,
                      tax_rate: 20,
                      discount_rate: 0,
                    }))
                    setItems(ocrItems)
                  } else if (result.total_amount) {
                    const singleItem: InvoiceFormItem = {
                      id: Date.now(),
                      description: result.vendor_name || 'OCR Taranan Fatura',
                      quantity: 1,
                      unit_price: result.total_amount / 1.2,
                      tax_rate: 20,
                      discount_rate: 0,
                    }
                    setItems([singleItem])
                  }

                  // Try to find matching customer
                  if (result.vendor_name) {
                    try {
                      const { data: companies } = await supabase
                        .from('companies')
                        .select('id, name')
                        .ilike('name', `%${result.vendor_name}%`)
                        .limit(1)

                      if (companies && companies.length > 0) {
                        setSelectedCompanyId(companies[0].id)
                      }
                    } catch (error) {
                      console.error('Customer search error:', error)
                    }
                  }

                  // Open modal for first invoice
                  if (index === 0) {
                    setShowModal(true)
                  }

                  processedCount++

                  if (processedCount === results.length) {
                    toast.success(`${results.length} fatura hazır! Lütfen her birini kontrol edip kaydedin.`, {
                      duration: 5000
                    })
                  }
                }, index * 300) // 300ms delay between each
              })
            }

            setShowBulkOCR(false)
          }}
        />
      )}
    </div>
  )
}
