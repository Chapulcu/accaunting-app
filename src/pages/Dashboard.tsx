import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Receipt,
  DollarSign,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import Tooltip from '@/components/Tooltip'
import CashFlowPredictionWidget from '@/components/dashboard/CashFlowPredictionWidget'
import N8nWorkflowStatusWidget from '@/components/dashboard/N8nWorkflowStatusWidget'
import RecentOCRScansWidget from '@/components/dashboard/RecentOCRScansWidget'

type DashboardMonthlyData = {
  ay: string
  gelir: number
  gider: number
}

type DashboardRecentInvoice = {
  invoice_number: string
  total_amount: number
  invoice_date: string | null
  companies: {
    name: string | null
  } | null
}

type DashboardRecentExpense = {
  description: string | null
  amount: number
  created_at: string
  expense_categories: {
    name: string | null
  } | null
}

type DashboardStats = {
  companyCount: number
  invoiceCount: number
  expenseCount: number
  totalRevenue: number
  totalExpenses: number
  monthlyData: DashboardMonthlyData[]
  recentInvoices: DashboardRecentInvoice[]
  recentExpenses: DashboardRecentExpense[]
}

// Mock data for charts
const revenueData: DashboardMonthlyData[] = [
  { ay: 'Ocak', gelir: 45000, gider: 28000 },
  { ay: 'Şubat', gelir: 52000, gider: 31000 },
  { ay: 'Mart', gelir: 48000, gider: 29000 },
  { ay: 'Nisan', gelir: 61000, gider: 35000 },
  { ay: 'Mayıs', gelir: 55000, gider: 32000 },
  { ay: 'Haziran', gelir: 67000, gider: 38000 },
]

export default function Dashboard() {
  const { user } = useAuth()

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      if (!user) {
        throw new Error('User not authenticated')
      }

      const [
        { count: companyCount },
        { count: invoiceCount },
        { count: expenseCount },
        { data: invoices },
        { data: expenses },
        { data: recentInvoices },
        { data: recentExpenses },
      ] = await Promise.all([
        supabase.from('companies').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('invoices').select('total_amount, invoice_date').eq('user_id', user.id),
        supabase.from('expenses').select('amount, expense_date').eq('user_id', user.id),
        supabase
          .from('invoices')
          .select('invoice_number, total_amount, created_at, invoice_date, companies(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('expenses').select('description, amount, created_at, expense_categories(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ])

      const invoiceRecords = (invoices ?? []).map((inv) => ({
        totalAmount: Number(inv.total_amount ?? 0),
        invoiceDate: String(inv.invoice_date),
      }))

      const expenseRecords = (expenses ?? []).map((expense) => ({
        amount: Number(expense.amount ?? 0),
        expenseDate: String(expense.expense_date),
      }))

      const revenue = invoiceRecords.reduce((sum, inv) => sum + inv.totalAmount, 0)
      const totalExpenses = expenseRecords.reduce((sum, exp) => sum + exp.amount, 0)

      // Calculate monthly revenue for last 6 months
      const monthlyData = Array.from({ length: 6 }, (_, i) => {
        const date = new Date()
        date.setMonth(date.getMonth() - (5 - i))
        const monthName = date.toLocaleDateString('tr-TR', { month: 'short' })
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]

        const monthRevenue = invoiceRecords
          .filter((inv) => inv.invoiceDate >= monthStart && inv.invoiceDate <= monthEnd)
          .reduce((sum, inv) => sum + inv.totalAmount, 0)

        const monthExpenses = expenseRecords
          .filter((exp) => exp.expenseDate >= monthStart && exp.expenseDate <= monthEnd)
          .reduce((sum, exp) => sum + exp.amount, 0)

        return { ay: monthName, gelir: monthRevenue, gider: monthExpenses }
      })

      const recentInvoiceRecords: DashboardRecentInvoice[] = (recentInvoices ?? []).map((invoice) => ({
        invoice_number: invoice.invoice_number,
        total_amount: Number(invoice.total_amount ?? 0),
        invoice_date: invoice.invoice_date ?? invoice.created_at,
        companies: invoice.companies ?? null,
      }))

      const recentExpenseRecords: DashboardRecentExpense[] = (recentExpenses ?? []).map((expense) => ({
        description: expense.description ?? null,
        amount: Number(expense.amount ?? 0),
        created_at: expense.created_at,
        expense_categories: expense.expense_categories ?? null,
      }))

      const result: DashboardStats = {
        companyCount: companyCount || 0,
        invoiceCount: invoiceCount || 0,
        expenseCount: expenseCount || 0,
        totalRevenue: revenue,
        totalExpenses: totalExpenses,
        monthlyData,
        recentInvoices: recentInvoiceRecords,
        recentExpenses: recentExpenseRecords,
      }

      return result
    },
    enabled: !!user,
  })

  const statCards = [
    {
      title: 'Toplam Cari',
      value: stats?.companyCount || 0,
      icon: Users,
      color: 'bg-blue-500',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Toplam Fatura',
      value: stats?.invoiceCount || 0,
      icon: FileText,
      color: 'bg-green-500',
      trend: '+8%',
      trendUp: true,
    },
    {
      title: 'Toplam Gider',
      value: stats?.expenseCount || 0,
      icon: Receipt,
      color: 'bg-orange-500',
      trend: '+5%',
      trendUp: true,
    },
    {
      title: 'Toplam Gelir',
      value: `₺${(stats?.totalRevenue || 0).toLocaleString('tr-TR')}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      trend: '+15%',
      trendUp: true,
    },
  ]

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
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <Tooltip content="İşletmenizin finansal özeti: gelir/gider istatistikleri, son faturalar, aylık trendler ve genel performans göstergeleri." />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          İşletmenizin genel durumunu görüntüleyin
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const TrendIcon = stat.trendUp ? TrendingUp : TrendingDown

          return (
            <div key={stat.title} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendIcon
                      className={`w-4 h-4 ${
                        stat.trendUp ? 'text-green-500' : 'text-red-500'
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        stat.trendUp ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {stat.trend}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      bu ay
                    </span>
                  </div>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Gelir ve Gider Trendi
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats?.monthlyData || revenueData}>
              <defs>
                <linearGradient id="colorGelir" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGider" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="ay" />
              <YAxis />
              <ChartTooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="gelir"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorGelir)"
                name="Gelir"
              />
              <Area
                type="monotone"
                dataKey="gider"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorGider)"
                name="Gider"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Comparison */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Aylık Karşılaştırma
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.monthlyData || revenueData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="ay" />
              <YAxis />
              <ChartTooltip />
              <Legend />
              <Bar dataKey="gelir" fill="#10b981" name="Gelir" />
              <Bar dataKey="gider" fill="#ef4444" name="Gider" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Son Faturalar
          </h2>
          <div className="space-y-3">
            {stats?.recentInvoices && stats.recentInvoices.length > 0 ? (
              stats.recentInvoices.map((invoice, index) => {
                const invoiceDate = invoice.invoice_date ?? null
                const timeAgo = new Date(
                  invoiceDate ?? new Date().toISOString()
                ).toLocaleDateString('tr-TR')
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.invoice_number}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {invoice.companies?.name || 'Cari'} • {timeAgo}
                        </p>
                      </div>
                   </div>
                   <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      ₺{invoice.total_amount.toLocaleString('tr-TR')}
                    </span>
                  </div>
                )
              })
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Henüz fatura bulunmuyor
              </p>
            )}
          </div>
        </div>

        {/* Recent Expenses */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Son Giderler
          </h2>
          <div className="space-y-3">
            {stats?.recentExpenses && stats.recentExpenses.length > 0 ? (
              stats.recentExpenses.map((expense, index) => {
                const timeAgo = new Date(expense.created_at).toLocaleDateString('tr-TR')
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {expense.description || 'Gider'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {expense.expense_categories?.name || 'Kategori'} • {timeAgo}
                        </p>
                      </div>
                   </div>
                   <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      ₺{expense.amount.toLocaleString('tr-TR')}
                    </span>
                  </div>
                )
              })
            ) : (
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                Henüz gider bulunmuyor
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI & Automation Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Prediction Widget */}
        <div className="lg:col-span-2">
          <CashFlowPredictionWidget />
        </div>

        {/* n8n Workflow Status Widget */}
        <div>
          <N8nWorkflowStatusWidget />
        </div>
      </div>

      {/* Recent OCR Scans Widget */}
      <div className="grid grid-cols-1 gap-6">
        <RecentOCRScansWidget />
      </div>
    </div>
  )
}
