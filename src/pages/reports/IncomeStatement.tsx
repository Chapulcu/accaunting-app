import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Download, Printer, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import toast from 'react-hot-toast'
import Tooltip from '@/components/Tooltip'

interface IncomeStatementData {
  revenue: {
    sales: number
    otherIncome: number
    total: number
  }
  expenses: {
    operatingExpenses: number
    administrativeExpenses: number
    otherExpenses: number
    total: number
  }
  netIncome: number
  profitMargin: number
}

export default function IncomeStatement() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const { data, isLoading } = useQuery({
    queryKey: ['income-statement', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user) return null

      // Gelirler - Faturalardan
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, status')
        .eq('user_id', user.id)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .in('status', ['sent', 'paid'])

      const sales = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0

      // Giderler
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, expense_categories(name)')
        .eq('user_id', user.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .eq('status', 'approved')

      const operatingExpenses = expenses?.filter(e =>
        ['Kira', 'Elektrik', 'Su', 'İnternet', 'Ofis Malzemeleri'].includes(e.expense_categories?.name || '')
      ).reduce((sum, e) => sum + e.amount, 0) || 0

      const administrativeExpenses = expenses?.filter(e =>
        ['Maaş', 'Danışmanlık'].includes(e.expense_categories?.name || '')
      ).reduce((sum, e) => sum + e.amount, 0) || 0

      const otherExpenses = expenses?.filter(e =>
        !['Kira', 'Elektrik', 'Su', 'İnternet', 'Ofis Malzemeleri', 'Maaş', 'Danışmanlık'].includes(e.expense_categories?.name || '')
      ).reduce((sum, e) => sum + e.amount, 0) || 0

      const totalRevenue = sales
      const totalExpenses = operatingExpenses + administrativeExpenses + otherExpenses
      const netIncome = totalRevenue - totalExpenses
      const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

      return {
        revenue: {
          sales,
          otherIncome: 0,
          total: totalRevenue,
        },
        expenses: {
          operatingExpenses,
          administrativeExpenses,
          otherExpenses,
          total: totalExpenses,
        },
        netIncome,
        profitMargin,
      } as IncomeStatementData
    },
    enabled: !!user,
  })

  const handleExport = () => {
    if (!data) {
      toast.error('Dışa aktarılacak veri bulunamadı')
      return
    }

    const period = `${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}`

    const excelData = [
      { Kategori: 'Bilgi', Kalem: 'Dönem', Tutar: period },
      { Kategori: 'Gelirler', Kalem: 'Satış Gelirleri', Tutar: data.revenue.sales.toFixed(2) },
      { Kategori: 'Gelirler', Kalem: 'Diğer Gelirler', Tutar: data.revenue.otherIncome.toFixed(2) },
      { Kategori: 'Gelirler', Kalem: 'Toplam Gelir', Tutar: data.revenue.total.toFixed(2) },
      { Kategori: 'Giderler', Kalem: 'Faaliyet Giderleri', Tutar: data.expenses.operatingExpenses.toFixed(2) },
      { Kategori: 'Giderler', Kalem: 'İdari Giderler', Tutar: data.expenses.administrativeExpenses.toFixed(2) },
      { Kategori: 'Giderler', Kalem: 'Diğer Giderler', Tutar: data.expenses.otherExpenses.toFixed(2) },
      { Kategori: 'Giderler', Kalem: 'Toplam Gider', Tutar: data.expenses.total.toFixed(2) },
      { Kategori: 'Özet', Kalem: 'Net Kar/Zarar', Tutar: data.netIncome.toFixed(2) },
      { Kategori: 'Özet', Kalem: 'Kar Marjı (%)', Tutar: data.profitMargin.toFixed(2) },
    ]

    exportToExcel(excelData, 'Gelir_Tablosu', `gelir-tablosu-${startDate}-${endDate}`)
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
              Gelir Tablosu
            </h1>
            <Tooltip content="Dönemsel gelir ve gider analizi. Satış gelirleri, faaliyet giderleri ve net kar/zarar durumunu görüntüleyin. Kar marjını takip edin." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Income Statement - Kar/Zarar Raporu
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

      {/* Date Filter */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Başlangıç Tarihi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bitiş Tarihi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-slate-800 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Toplam Gelir
                </span>
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                ₺{data.revenue.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="card bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-800 border-2 border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Toplam Gider
                </span>
                <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                ₺{data.expenses.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`card bg-gradient-to-br ${
              data.netIncome >= 0
                ? 'from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800 border-2 border-blue-200 dark:border-blue-800'
                : 'from-orange-50 to-white dark:from-orange-900/20 dark:to-slate-800 border-2 border-orange-200 dark:border-orange-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  data.netIncome >= 0
                    ? 'text-blue-700 dark:text-blue-300'
                    : 'text-orange-700 dark:text-orange-300'
                }`}>
                  Net {data.netIncome >= 0 ? 'Kar' : 'Zarar'}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-white dark:bg-slate-700">
                  %{Math.abs(data.profitMargin).toFixed(2)}
                </span>
              </div>
              <p className={`text-3xl font-bold ${
                data.netIncome >= 0
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-orange-900 dark:text-orange-100'
              }`}>
                ₺{Math.abs(data.netIncome).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Detailed Report */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              Detaylı Rapor
            </h2>

            {/* Revenue Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Gelirler
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Satış Gelirleri</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.revenue.sales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Diğer Gelirler</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.revenue.otherIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <span className="font-bold text-green-900 dark:text-green-100">Toplam Gelir</span>
                  <span className="text-xl font-bold text-green-900 dark:text-green-100">
                    ₺{data.revenue.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Giderler
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Faaliyet Giderleri</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.expenses.operatingExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">İdari Giderler</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.expenses.administrativeExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">Diğer Giderler</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.expenses.otherExpenses.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border-2 border-red-200 dark:border-red-800">
                  <span className="font-bold text-red-900 dark:text-red-100">Toplam Gider</span>
                  <span className="text-xl font-bold text-red-900 dark:text-red-100">
                    ₺{data.expenses.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Income */}
            <div className={`p-6 rounded-xl border-4 ${
              data.netIncome >= 0
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
            }`}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-2xl font-bold ${
                    data.netIncome >= 0
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-orange-900 dark:text-orange-100'
                  }`}>
                    Net {data.netIncome >= 0 ? 'Kar' : 'Zarar'}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    data.netIncome >= 0
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-orange-700 dark:text-orange-300'
                  }`}>
                    Kar Marjı: %{Math.abs(data.profitMargin).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-4xl font-bold ${
                    data.netIncome >= 0
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-orange-900 dark:text-orange-100'
                  }`}>
                    {data.netIncome < 0 && '-'}₺{Math.abs(data.netIncome).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Seçilen dönem için veri bulunamadı
          </p>
        </div>
      )}
    </div>
  )
}
