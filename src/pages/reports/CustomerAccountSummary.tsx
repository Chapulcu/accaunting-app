import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Download, Printer, Search, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import toast from 'react-hot-toast'
import Tooltip from '@/components/Tooltip'

interface CustomerBalance {
  customer_id: number
  customer_name: string
  total_invoiced: number
  total_paid: number
  balance: number
  invoice_count: number
}

export default function CustomerAccountSummary() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customer-account-summary', user?.id],
    queryFn: async () => {
      if (!user) return []

      // Müşteri bazlı fatura ve ödeme bilgileri
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          customer_id,
          total_amount,
          status,
          companies!invoices_customer_id_fkey (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .not('companies', 'is', null)

      if (!invoices) return []

      // Ödemeleri çek
      const { data: payments } = await supabase
        .from('payments')
        .select('invoice_id, amount')

      const paymentsByInvoice = new Map<number, number>()
      payments?.forEach(p => {
        const current = paymentsByInvoice.get(p.invoice_id) || 0
        paymentsByInvoice.set(p.invoice_id, current + p.amount)
      })

      // Müşteri bazlı toplamları hesapla
      const customerMap = new Map<number, CustomerBalance>()

      invoices.forEach((inv: any) => {
        const company = Array.isArray(inv.companies) ? inv.companies[0] : inv.companies
        if (!company || !inv.customer_id) return

        const customerId = inv.customer_id
        const existing = customerMap.get(customerId) || {
          customer_id: customerId,
          customer_name: company.name || 'Bilinmeyen',
          total_invoiced: 0,
          total_paid: 0,
          balance: 0,
          invoice_count: 0,
        }

        const invoiceTotal = inv.total_amount || 0
        const paidAmount = paymentsByInvoice.get(inv.id) || 0

        existing.total_invoiced += invoiceTotal
        existing.total_paid += paidAmount
        existing.balance = existing.total_invoiced - existing.total_paid
        existing.invoice_count += 1

        customerMap.set(customerId, existing)
      })

      return Array.from(customerMap.values()).sort((a, b) => b.balance - a.balance)
    },
    enabled: !!user,
  })

  const filteredCustomers = customers?.filter(c =>
    c.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const totalInvoiced = filteredCustomers.reduce((sum, c) => sum + c.total_invoiced, 0)
  const totalPaid = filteredCustomers.reduce((sum, c) => sum + c.total_paid, 0)
  const totalBalance = filteredCustomers.reduce((sum, c) => sum + c.balance, 0)

  const handleExport = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) {
      toast.error('Dışa aktarılacak veri bulunamadı')
      return
    }

    const excelData = [
      ['CARİ HESAP ÖZETİ'],
      ['Tarih:', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Müşteri Adı', 'Fatura Toplamı', 'Ödenen', 'Bakiye', 'Fatura Sayısı'],
      ...filteredCustomers.map(c => [
        c.customer_name,
        c.total_invoiced.toFixed(2),
        c.total_paid.toFixed(2),
        c.balance.toFixed(2),
        c.invoice_count.toString(),
      ]),
      [],
      ['TOPLAM', totalInvoiced.toFixed(2), totalPaid.toFixed(2), totalBalance.toFixed(2), ''],
    ]

    exportToExcel(excelData, 'Cari_Hesap_Özeti', 'cari-hesap-ozeti')
    toast.success('Excel dosyası indirildi')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Cari Hesap Özeti
            </h1>
            <Tooltip content="Müşteri bazlı alacak-borç raporu. Her müşterinin toplam faturası, ödemesi ve kalan bakiyesini görüntüleyin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Müşteri Bazlı Alacak/Borç Durumu
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary">
            <Printer className="w-5 h-5 mr-2" />
            Yazdır
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-5 h-5 mr-2" />
            Excel
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Toplam Fatura
            </span>
            <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
            ₺{totalInvoiced.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-slate-800 border-2 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Toplam Ödenen
            </span>
            <TrendingDown className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-900 dark:text-green-100">
            ₺{totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800 border-2 border-orange-200 dark:border-orange-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Toplam Bakiye
            </span>
            <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-900 dark:text-orange-100">
            ₺{totalBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Müşteri ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : filteredCustomers.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Müşteri
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Fatura Sayısı
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Toplam Fatura
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Ödenen
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Bakiye
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Ödeme Oranı
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const paymentRate = customer.total_invoiced > 0
                    ? (customer.total_paid / customer.total_invoiced) * 100
                    : 0

                  return (
                    <tr
                      key={customer.customer_id}
                      className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {customer.customer_name}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-gray-600 dark:text-gray-400">
                          {customer.invoice_count}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ₺{customer.total_invoiced.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-green-600 dark:text-green-400 font-semibold">
                          ₺{customer.total_paid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`font-bold ${
                          customer.balance > 0
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          ₺{customer.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                paymentRate >= 100
                                  ? 'bg-green-500'
                                  : paymentRate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(paymentRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                            %{paymentRate.toFixed(0)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <td className="p-4 font-bold text-gray-900 dark:text-white">
                    TOPLAM
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                    {filteredCustomers.reduce((sum, c) => sum + c.invoice_count, 0)}
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                    ₺{totalInvoiced.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-green-600 dark:text-green-400">
                    ₺{totalPaid.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-orange-600 dark:text-orange-400">
                    ₺{totalBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                    %{totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(0) : 0}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz cari hesap verisi bulunmuyor'}
          </p>
        </div>
      )}
    </div>
  )
}
