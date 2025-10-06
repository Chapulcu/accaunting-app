import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/types/database'

type AccountRecord = Database['public']['Tables']['chart_of_accounts']['Row']
type JournalEntryLineRecord = Database['public']['Tables']['journal_entry_lines']['Row'] & {
  journal_entries: {
    user_id: string
    status: string
    entry_date: string
  }
}

interface TrialBalanceItem {
  account_code: string
  account_name: string
  account_type: string
  debit: number
  credit: number
}

export default function TrialBalance() {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const { user } = useAuth()

  // Fetch trial balance data from account_balances view
  const { data: trialBalance, isLoading } = useQuery({
    queryKey: ['trial-balance', startDate, endDate, user?.id],
    queryFn: async () => {
      if (!user) throw new Error('User not authenticated')

      const [{ data: accounts, error: accountsError }, { data: lines, error: linesError }] = await Promise.all([
        supabase
          .from('chart_of_accounts')
          .select('id, code, name, account_type')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('journal_entry_lines')
          .select(
            `account_id, debit, credit,
            journal_entries!inner(user_id, status, entry_date)`
          )
          .eq('journal_entries.user_id', user.id)
          .eq('journal_entries.status', 'posted')
          .gte('journal_entries.entry_date', startDate)
          .lte('journal_entries.entry_date', endDate),
      ])

      if (accountsError) throw accountsError
      if (linesError) throw linesError

      const totals = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>()

      const accountList = (accounts ?? []) as AccountRecord[]
      accountList.forEach((account) => {
        if (!account.id) return
        totals.set(account.id, {
          code: account.code ?? '',
          name: account.name ?? '',
          type: account.account_type ?? 'asset',
          debit: 0,
          credit: 0,
        })
      })

      const lineList = (lines ?? []) as JournalEntryLineRecord[]
      lineList.forEach((line) => {
        const account = totals.get(line.account_id)
        if (!account) return

        account.debit += Number(line.debit || 0)
        account.credit += Number(line.credit || 0)
      })

      const items: TrialBalanceItem[] = []

      totals.forEach((account) => {
        if (Math.abs(account.debit) < 0.01 && Math.abs(account.credit) < 0.01) {
          return
        }

        items.push({
          account_code: account.code,
          account_name: account.name,
          account_type: account.type,
          debit: account.debit,
          credit: account.credit,
        })
      })

      return items.sort((a, b) => a.account_code.localeCompare(b.account_code))
    },
    enabled: !!user,
  })

  const totalDebit = trialBalance?.reduce((sum, item) => sum + item.debit, 0) || 0
  const totalCredit = trialBalance?.reduce((sum, item) => sum + item.credit, 0) || 0

  const handleExport = () => {
    if (!trialBalance || trialBalance.length === 0) {
      toast.error('Dışa aktarılacak veri bulunamadı')
      return
    }

    const headers = ['Hesap Kodu', 'Hesap Adı', 'Borç (₺)', 'Alacak (₺)']
    const rows = trialBalance.map((item) => [
      item.account_code,
      item.account_name,
      item.debit.toFixed(2),
      item.credit.toFixed(2),
    ])

    rows.push(['', 'TOPLAM', totalDebit.toFixed(2), totalCredit.toFixed(2)])

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `Mizan_${startDate}_${endDate}.csv`
    link.click()

    toast.success('Mizan raporu dışa aktarıldı')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Mizan (Trial Balance)
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Hesapların borç-alacak toplamları
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            CSV İndir
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Yazdır
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Başlangıç Tarihi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field !pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bitiş Tarihi
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field !pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-300 dark:border-slate-600">
                  <th className="text-left py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">
                    Hesap Kodu
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">
                    Hesap Adı
                  </th>
                  <th className="text-right py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">
                    Borç (₺)
                  </th>
                  <th className="text-right py-4 px-4 text-sm font-bold text-gray-900 dark:text-white">
                    Alacak (₺)
                  </th>
                </tr>
              </thead>
              <tbody>
                {trialBalance && trialBalance.length > 0 ? (
                  <>
                    {trialBalance.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {item.account_code}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          {item.account_name}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                          {item.debit > 0
                            ? `₺${item.debit.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                              })}`
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                          {item.credit > 0
                            ? `₺${item.credit.toLocaleString('tr-TR', {
                                minimumFractionDigits: 2,
                              })}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="border-t-2 border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-800/50">
                      <td
                        colSpan={2}
                        className="py-4 px-4 text-lg font-bold text-gray-900 dark:text-white"
                      >
                        TOPLAM
                      </td>
                      <td className="py-4 px-4 text-right text-lg font-bold text-blue-600 dark:text-blue-400">
                        ₺
                        {totalDebit.toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-4 text-right text-lg font-bold text-green-600 dark:text-green-400">
                        ₺
                        {totalCredit.toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                    {/* Balance Check */}
                    <tr className="bg-gray-50 dark:bg-slate-900/50">
                      <td
                        colSpan={2}
                        className="py-3 px-4 font-medium text-gray-700 dark:text-gray-300"
                      >
                        Fark
                      </td>
                      <td
                        colSpan={2}
                        className={`py-3 px-4 text-right font-bold ${
                          totalDebit === totalCredit
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {totalDebit === totalCredit ? (
                          <span className="flex items-center justify-end gap-2">
                            ✓ Dengede
                          </span>
                        ) : (
                          `₺${Math.abs(totalDebit - totalCredit).toLocaleString('tr-TR', {
                            minimumFractionDigits: 2,
                          })}`
                        )}
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-600 dark:text-gray-400">
                      Seçili tarih aralığında işlem bulunamadı
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Mizan Nedir?</strong> Mizan, belirli bir dönemde tüm hesapların borç ve
          alacak toplamlarını gösteren bir rapordur. Doğru tutulduğunda, borç ve alacak
          toplamları birbirine eşit olmalıdır.
        </p>
      </div>
    </div>
  )
}
