import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  DollarSign,
  PieChart,
} from 'lucide-react'

interface ReportData {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  totalInvoices: number
  totalCompanies: number
  expensesByCategory: Array<{ category: string; amount: number }>
  monthlyRevenue: Array<{ month: string; amount: number }>
}

type InvoiceSummary = {
  total_amount: number | null
  invoice_date: string
}

type ExpenseSummary = {
  amount: number | null
  expense_date: string
  expense_categories: {
    name: string | null
  } | null
}

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  // Fetch report data
  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ['reports', dateRange],
    queryFn: async () => {
      // Fetch invoices (revenue)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, invoice_date')
        .gte('invoice_date', dateRange.startDate)
        .lte('invoice_date', dateRange.endDate)

      // Fetch expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category_id, expense_date, expense_categories(name)')
        .gte('expense_date', dateRange.startDate)
        .lte('expense_date', dateRange.endDate)

      // Fetch customers count
      const { count: companyCount } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true })

      // Calculate totals
      const invoiceSummaries: InvoiceSummary[] = (invoices as InvoiceSummary[]) || []
      const expenseSummaries: ExpenseSummary[] = ((expenses as any[]) || []).map(exp => ({
        ...exp,
        expense_categories: Array.isArray(exp.expense_categories) ? exp.expense_categories[0] : exp.expense_categories
      })) as ExpenseSummary[]

      const totalRevenue = invoiceSummaries.reduce(
        (sum, inv) => sum + Number(inv.total_amount || 0),
        0,
      )
      const totalExpenses = expenseSummaries.reduce(
        (sum, exp) => sum + Number(exp.amount || 0),
        0,
      )
      const netIncome = totalRevenue - totalExpenses

      // Group expenses by category
      const expensesByCategory = expenseSummaries.reduce(
        (acc, exp) => {
          const categoryName = exp.expense_categories?.name || 'Diğer'
          const existing = acc.find((item) => item.category === categoryName)
          if (existing) {
            existing.amount += Number(exp.amount || 0)
          } else {
            acc.push({ category: categoryName, amount: Number(exp.amount || 0) })
          }
          return acc
        },
        [] as Array<{ category: string; amount: number }>,
      )

      // Monthly revenue (last 6 months)
      const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - (5 - i))
        const month = date.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
          .toISOString()
          .split('T')[0]
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)
          .toISOString()
          .split('T')[0]

        const monthTotal =
          invoiceSummaries
            .filter(
              (inv) =>
                inv.invoice_date >= monthStart && inv.invoice_date <= monthEnd,
            )
            .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0) || 0

        return { month, amount: monthTotal }
      })

      const result: ReportData = {
        totalRevenue,
        totalExpenses,
        netIncome,
        totalInvoices: invoices?.length || 0,
        totalCompanies: companyCount || 0,
        expensesByCategory: expensesByCategory
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        monthlyRevenue,
      }

      return result
    },
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount)
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Raporlar</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Finansal raporlarınızı görüntüleyin
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-gray-400" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Başlangıç Tarihi
              </label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bitiş Tarihi
              </label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Gelir</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatCurrency(reportData?.totalRevenue || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Gider</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(reportData?.totalExpenses || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Gelir</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  (reportData?.netIncome || 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatCurrency(reportData?.netIncome || 0)}
              </p>
            </div>
            <div className="p-3 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Fatura</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reportData?.totalInvoices || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Aylık Gelir Trendi
            </h2>
          </div>
          <div className="space-y-4">
            {(reportData?.monthlyRevenue ?? []).map((item, idx, arr) => {
              const maxAmount = Math.max(
                ...arr.map((m) => m.amount),
                1
              )
              const percentage = (item.amount / maxAmount) * 100
              return (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">{item.month}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Expenses by Category */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <PieChart className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Kategoriye Göre Giderler
            </h2>
          </div>
          <div className="space-y-4">
            {(reportData?.expensesByCategory ?? []).length === 0 ? (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Bu dönemde gider bulunmuyor
              </p>
            ) : (
              (reportData?.expensesByCategory ?? []).map((item, idx, arr) => {
                const maxAmount = Math.max(
                  ...arr.map((c) => c.amount),
                  1
                )
                const percentage = (item.amount / maxAmount) * 100
                const colors = [
                  'bg-red-500',
                  'bg-orange-500',
                  'bg-yellow-500',
                  'bg-green-500',
                  'bg-blue-500',
                ]
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">
                        {item.category}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`${colors[idx % colors.length]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Income Statement */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gelir Tablosu</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                  Gelirler
                </td>
                <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-semibold">
                  {formatCurrency(reportData?.totalRevenue || 0)}
                </td>
              </tr>
              <tr className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">
                  Giderler
                </td>
                <td className="py-3 px-4 text-right text-red-600 dark:text-red-400 font-semibold">
                  ({formatCurrency(reportData?.totalExpenses || 0)})
                </td>
              </tr>
              <tr className="bg-gray-100 dark:bg-slate-800 font-bold">
                <td className="py-3 px-4 text-gray-900 dark:text-white">Net Gelir</td>
                <td
                  className={`py-3 px-4 text-right text-lg ${
                    (reportData?.netIncome || 0) >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(reportData?.netIncome || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
