import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { exportBalanceSheetToExcel } from '@/lib/excelExport'
import type { Database } from '@/types/database'

type AccountRecord = Database['public']['Tables']['chart_of_accounts']['Row']
type JournalEntryLineRecord = Database['public']['Tables']['journal_entry_lines']['Row'] & {
  journal_entries: {
    user_id: string
    status: string
    entry_date: string
  }
}

interface BalanceSheetItem {
  account_code: string
  account_name: string
  amount: number
}

interface BalanceSheetData {
  assets: {
    current: BalanceSheetItem[]
    fixed: BalanceSheetItem[]
  }
  liabilities: {
    shortTerm: BalanceSheetItem[]
    longTerm: BalanceSheetItem[]
  }
  equity: BalanceSheetItem[]
}

export default function BalanceSheet() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const { user } = useAuth()

  // Fetch balance sheet data from account_balances view
  const { data: balanceSheet, isLoading } = useQuery({
    queryKey: ['balance-sheet', asOfDate, user?.id],
    queryFn: async (): Promise<BalanceSheetData> => {
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
          .lte('journal_entries.entry_date', asOfDate),
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

      const currentAssets: BalanceSheetItem[] = []
      const fixedAssets: BalanceSheetItem[] = []
      const shortTermLiabilities: BalanceSheetItem[] = []
      const longTermLiabilities: BalanceSheetItem[] = []
      const equity: BalanceSheetItem[] = []

      totals.forEach((account) => {
        const balance = account.type === 'asset' || account.type === 'expense'
          ? account.debit - account.credit
          : account.credit - account.debit

        if (Math.abs(balance) < 0.01) return

        if (!account.code) return
        const codeNumber = parseInt(account.code, 10)
        if (Number.isNaN(codeNumber)) return

        const item: BalanceSheetItem = {
          account_code: account.code,
          account_name: account.name,
          amount: balance,
        }

        if (codeNumber >= 100 && codeNumber < 200) {
          currentAssets.push(item)
        } else if (codeNumber >= 200 && codeNumber < 300) {
          fixedAssets.push(item)
        } else if (codeNumber >= 300 && codeNumber < 400) {
          shortTermLiabilities.push(item)
        } else if (codeNumber >= 400 && codeNumber < 500) {
          longTermLiabilities.push(item)
        } else if (codeNumber >= 500 && codeNumber < 600) {
          equity.push(item)
        }
      })

      return {
        assets: {
          current: currentAssets.sort((a, b) => a.account_code.localeCompare(b.account_code)),
          fixed: fixedAssets.sort((a, b) => a.account_code.localeCompare(b.account_code)),
        },
        liabilities: {
          shortTerm: shortTermLiabilities.sort((a, b) => a.account_code.localeCompare(b.account_code)),
          longTerm: longTermLiabilities.sort((a, b) => a.account_code.localeCompare(b.account_code)),
        },
        equity: equity.sort((a, b) => a.account_code.localeCompare(b.account_code)),
      }
    },
    enabled: !!user,
  })

  const totalCurrentAssets =
    balanceSheet?.assets.current.reduce((sum, item) => sum + item.amount, 0) || 0
  const totalFixedAssets =
    balanceSheet?.assets.fixed.reduce((sum, item) => sum + item.amount, 0) || 0
  const totalAssets = totalCurrentAssets + totalFixedAssets

  const totalShortTermLiabilities =
    balanceSheet?.liabilities.shortTerm.reduce((sum, item) => sum + item.amount, 0) || 0
  const totalLongTermLiabilities =
    balanceSheet?.liabilities.longTerm.reduce((sum, item) => sum + item.amount, 0) || 0
  const totalLiabilities = totalShortTermLiabilities + totalLongTermLiabilities

  const totalEquity =
    balanceSheet?.equity.reduce((sum, item) => sum + item.amount, 0) || 0
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity

  const handleExport = () => {
    if (!balanceSheet) {
      toast.error('Dışa aktarılacak veri bulunamadı')
      return
    }

    exportBalanceSheetToExcel({
      assets: [...balanceSheet.assets.current, ...balanceSheet.assets.fixed].map((item) => ({
        code: item.account_code,
        name: item.account_name,
        balance: item.amount,
      })),
      liabilities: [...balanceSheet.liabilities.shortTerm, ...balanceSheet.liabilities.longTerm].map((item) => ({
        code: item.account_code,
        name: item.account_name,
        balance: item.amount,
      })),
      equity: balanceSheet.equity.map((item) => ({
        code: item.account_code,
        name: item.account_name,
        balance: item.amount,
      })),
      totalAssets,
      totalLiabilities,
      totalEquity,
    })

    toast.success('Bilanço Excel olarak indirildi')
  }

  const handlePrint = () => {
    window.print()
  }

  const renderItems = (items: BalanceSheetItem[]) => {
    return items.map((item, index) => (
      <tr
        key={index}
        className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50"
      >
        <td className="py-2 px-4 text-sm text-gray-600 dark:text-gray-400">
          {item.account_code}
        </td>
        <td className="py-2 px-4 text-gray-900 dark:text-white">{item.account_name}</td>
        <td className="py-2 px-4 text-right font-medium text-gray-900 dark:text-white">
          ₺{Math.abs(item.amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bilanço (Balance Sheet)
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Şirketin finansal durumu
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-5 h-5" />
            Excel İndir
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Yazdır
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="card">
        <div className="max-w-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Bilanço Tarihi
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="input-field !pl-10"
            />
          </div>
        </div>
      </div>

      {/* Balance Sheet */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
              AKTİFLER (Varlıklar)
            </h2>

            {/* Current Assets */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Dönen Varlıklar
              </h3>
              <table className="w-full">
                <tbody>{renderItems(balanceSheet?.assets.current || [])}</tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={2} className="py-2 px-4 font-semibold text-gray-900 dark:text-white">
                      Toplam Dönen Varlıklar
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      ₺{totalCurrentAssets.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Fixed Assets */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Duran Varlıklar
              </h3>
              <table className="w-full">
                <tbody>{renderItems(balanceSheet?.assets.fixed || [])}</tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={2} className="py-2 px-4 font-semibold text-gray-900 dark:text-white">
                      Toplam Duran Varlıklar
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      ₺{totalFixedAssets.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Total Assets */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  TOPLAM AKTİFLER
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  ₺{totalAssets.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Liabilities & Equity */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pb-3 border-b border-gray-200 dark:border-slate-700">
              PASİFLER (Kaynaklar)
            </h2>

            {/* Short-term Liabilities */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Kısa Vadeli Yükümlülükler
              </h3>
              <table className="w-full">
                <tbody>{renderItems(balanceSheet?.liabilities.shortTerm || [])}</tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={2} className="py-2 px-4 font-semibold text-gray-900 dark:text-white">
                      Toplam Kısa Vadeli
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-red-600 dark:text-red-400">
                      ₺{totalShortTermLiabilities.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Long-term Liabilities */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Uzun Vadeli Yükümlülükler
              </h3>
              <table className="w-full">
                <tbody>{renderItems(balanceSheet?.liabilities.longTerm || [])}</tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={2} className="py-2 px-4 font-semibold text-gray-900 dark:text-white">
                      Toplam Uzun Vadeli
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-red-600 dark:text-red-400">
                      ₺{totalLongTermLiabilities.toLocaleString('tr-TR', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Equity */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Özsermaye
              </h3>
              <table className="w-full">
                <tbody>{renderItems(balanceSheet?.equity || [])}</tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-slate-600">
                    <td colSpan={2} className="py-2 px-4 font-semibold text-gray-900 dark:text-white">
                      Toplam Özsermaye
                    </td>
                    <td className="py-2 px-4 text-right font-bold text-green-600 dark:text-green-400">
                      ₺{totalEquity.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Total Liabilities & Equity */}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  TOPLAM PASİFLER
                </span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  ₺{totalLiabilitiesAndEquity.toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Check */}
      <div
        className={`card ${
          totalAssets === totalLiabilitiesAndEquity
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex justify-between items-center">
          <div>
            <p
              className={`font-bold ${
                totalAssets === totalLiabilitiesAndEquity
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}
            >
              {totalAssets === totalLiabilitiesAndEquity
                ? '✓ Bilanço Dengede'
                : '⚠ Bilanço Dengesiz!'}
            </p>
            <p
              className={`text-sm ${
                totalAssets === totalLiabilitiesAndEquity
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {totalAssets === totalLiabilitiesAndEquity
                ? 'Aktifler = Pasifler'
                : `Fark: ₺${Math.abs(totalAssets - totalLiabilitiesAndEquity).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
