import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Download, Printer, Search, AlertTriangle, Clock } from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import toast from 'react-hot-toast'
import Tooltip from '@/components/Tooltip'

interface AgingBucket {
  customer_id: number
  customer_name: string
  current: number // 0-30 gün
  days30: number // 31-60 gün
  days60: number // 61-90 gün
  days90: number // 90+ gün
  total: number
}

export default function AgingAnalysis() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: aging, isLoading } = useQuery({
    queryKey: ['aging-analysis', user?.id],
    queryFn: async () => {
      if (!user) return []

      const today = new Date()

      // Ödenmemiş faturaları çek
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          customer_id,
          total_amount,
          due_date,
          status,
          companies!invoices_customer_id_fkey (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['sent'])
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

      // Müşteri bazlı yaşlandırma
      const customerMap = new Map<number, AgingBucket>()

      invoices.forEach((inv: any) => {
        const company = Array.isArray(inv.companies) ? inv.companies[0] : inv.companies
        if (!company || !inv.customer_id) return

        const customerId = inv.customer_id
        const existing = customerMap.get(customerId) || {
          customer_id: customerId,
          customer_name: company.name || 'Bilinmeyen',
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          total: 0,
        }

        const invoiceTotal = inv.total_amount || 0
        const paidAmount = paymentsByInvoice.get(inv.id) || 0
        const balance = invoiceTotal - paidAmount

        if (balance <= 0) return // Tam ödenmiş

        // Vade geçmiş gün sayısı
        const dueDate = inv.due_date ? new Date(inv.due_date) : today
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        if (daysOverdue <= 30) {
          existing.current += balance
        } else if (daysOverdue <= 60) {
          existing.days30 += balance
        } else if (daysOverdue <= 90) {
          existing.days60 += balance
        } else {
          existing.days90 += balance
        }

        existing.total += balance
        customerMap.set(customerId, existing)
      })

      return Array.from(customerMap.values()).sort((a, b) => b.total - a.total)
    },
    enabled: !!user,
  })

  const filteredAging = aging?.filter(a =>
    a.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const totals = {
    current: filteredAging.reduce((sum, a) => sum + a.current, 0),
    days30: filteredAging.reduce((sum, a) => sum + a.days30, 0),
    days60: filteredAging.reduce((sum, a) => sum + a.days60, 0),
    days90: filteredAging.reduce((sum, a) => sum + a.days90, 0),
    total: filteredAging.reduce((sum, a) => sum + a.total, 0),
  }

  const handleExport = () => {
    if (!filteredAging || filteredAging.length === 0) {
      toast.error('Dışa aktarılacak veri bulunamadı')
      return
    }

    const excelData = [
      ['YAŞLANDIRMA ANALİZİ'],
      ['Tarih:', new Date().toLocaleDateString('tr-TR')],
      [],
      ['Müşteri', '0-30 Gün', '31-60 Gün', '61-90 Gün', '90+ Gün', 'Toplam'],
      ...filteredAging.map(a => [
        a.customer_name,
        a.current.toFixed(2),
        a.days30.toFixed(2),
        a.days60.toFixed(2),
        a.days90.toFixed(2),
        a.total.toFixed(2),
      ]),
      [],
      [
        'TOPLAM',
        totals.current.toFixed(2),
        totals.days30.toFixed(2),
        totals.days60.toFixed(2),
        totals.days90.toFixed(2),
        totals.total.toFixed(2),
      ],
    ]

    exportToExcel(excelData, 'Yaşlandırma_Analizi', 'yaslandirma-analizi')
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
              Yaşlandırma Analizi
            </h1>
            <Tooltip content="Vadesi geçmiş alacakların analizi. Müşteri bazlı borçları vade aralıklarına göre (0-30, 31-60, 61-90, 90+) kategorize edin. Risk analizi yapın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Aging Analysis - Vadesi Geçmiş Alacaklar
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-slate-800 border-2 border-green-200 dark:border-green-800">
          <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
            0-30 Gün
          </div>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">
            ₺{totals.current.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-yellow-50 to-white dark:from-yellow-900/20 dark:to-slate-800 border-2 border-yellow-200 dark:border-yellow-800">
          <div className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">
            31-60 Gün
          </div>
          <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
            ₺{totals.days30.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800 border-2 border-orange-200 dark:border-orange-800">
          <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
            61-90 Gün
          </div>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
            ₺{totals.days60.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-800 border-2 border-red-200 dark:border-red-800">
          <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
            90+ Gün
          </div>
          <p className="text-2xl font-bold text-red-900 dark:text-red-100">
            ₺{totals.days90.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800 border-2 border-blue-200 dark:border-blue-800">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
            Toplam
          </div>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            ₺{totals.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
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
      ) : filteredAging.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                    Müşteri
                  </th>
                  <th className="text-right p-4 font-semibold text-green-700 dark:text-green-400">
                    0-30 Gün
                  </th>
                  <th className="text-right p-4 font-semibold text-yellow-700 dark:text-yellow-400">
                    31-60 Gün
                  </th>
                  <th className="text-right p-4 font-semibold text-orange-700 dark:text-orange-400">
                    61-90 Gün
                  </th>
                  <th className="text-right p-4 font-semibold text-red-700 dark:text-red-400">
                    90+ Gün
                  </th>
                  <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                    Toplam
                  </th>
                  <th className="text-center p-4 font-semibold text-gray-900 dark:text-white">
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAging.map((item) => {
                  const riskScore =
                    (item.days90 / item.total) * 100 > 50 ? 'high' :
                    (item.days60 / item.total) * 100 > 30 ? 'medium' : 'low'

                  return (
                    <tr
                      key={item.customer_id}
                      className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {item.customer_name}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-green-600 dark:text-green-400">
                          ₺{item.current.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-yellow-600 dark:text-yellow-400">
                          ₺{item.days30.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-orange-600 dark:text-orange-400">
                          ₺{item.days60.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          ₺{item.days90.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-gray-900 dark:text-white">
                          ₺{item.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          riskScore === 'high'
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : riskScore === 'medium'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        }`}>
                          {riskScore === 'high' && <AlertTriangle className="w-3 h-3" />}
                          {riskScore === 'high' ? 'Yüksek' : riskScore === 'medium' ? 'Orta' : 'Düşük'}
                        </span>
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
                  <td className="p-4 text-right font-bold text-green-600 dark:text-green-400">
                    ₺{totals.current.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-yellow-600 dark:text-yellow-400">
                    ₺{totals.days30.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-orange-600 dark:text-orange-400">
                    ₺{totals.days60.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">
                    ₺{totals.days90.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                    ₺{totals.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery ? 'Arama sonucu bulunamadı' : 'Vadesi geçmiş alacak bulunmuyor'}
          </p>
        </div>
      )}
    </div>
  )
}
