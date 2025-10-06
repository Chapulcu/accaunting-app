import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { Calendar, Lock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import Tooltip from '@/components/Tooltip'

export default function PeriodClose() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [closingDate, setClosingDate] = useState(
    new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
  )
  const [confirmText, setConfirmText] = useState('')

  // Close period mutation
  const closePeriodMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Kullanıcı doğrulanamadı')
      if (confirmText !== 'KAPAT') {
        throw new Error('Lütfen onay metnini doğru yazın')
      }

      // 1. Gelir-Gider hesaplarının bakiyelerini hesapla
      const { data: accounts, error: accountsError } = await supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', user.id)
        .in('type', ['revenue', 'expense'])

      if (accountsError) throw accountsError

      let totalRevenue = 0
      let totalExpense = 0

      accounts?.forEach((account) => {
        if (account.type === 'revenue') {
          totalRevenue += account.balance || 0
        } else if (account.type === 'expense') {
          totalExpense += account.balance || 0
        }
      })

      const netIncome = totalRevenue - totalExpense

      // 2. Dönem sonu yevmiye kaydı oluştur
      const { data: lastEntry } = await supabase
        .from('journal_entries')
        .select('entry_number')
        .eq('user_id', user.id)
        .order('entry_number', { ascending: false })
        .limit(1)
        .single()

      const lastNumber = lastEntry?.entry_number
        ? parseInt(lastEntry.entry_number.split('-')[1])
        : 0
      const entryNumber = `YEV-${String(lastNumber + 1).padStart(6, '0')}`

      // Dönem kapama kaydı oluştur
      const { data: closingEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          user_id: user.id,
          entry_date: closingDate,
          entry_number: entryNumber,
          description: `${new Date(closingDate).getFullYear()} Yılı Dönem Kapanış Kaydı`,
          status: 'posted',
          total_debit: Math.abs(netIncome),
          total_credit: Math.abs(netIncome),
          notes: 'Otomatik dönem kapanış kaydı',
          created_by: user.id,
        })
        .select()
        .single()

      if (entryError) throw entryError

      // 3. Gelir hesaplarını kapat (590 veya 591'e aktar)
      const lines = []

      // Kar veya zarar hesabı ID'sini bul
      const targetAccountCode = netIncome > 0 ? '590' : '591' // DÖNEM NET KARI veya ZARARI
      const { data: targetAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('code', targetAccountCode)
        .single()

      if (!targetAccount) {
        throw new Error(`${targetAccountCode} hesabı bulunamadı`)
      }

      // Gelir hesaplarını kapat
      for (const account of accounts || []) {
        if (account.type === 'revenue' && Math.abs(account.balance) > 0.01) {
          lines.push({
            journal_entry_id: closingEntry.id,
            account_id: account.id,
            debit: account.balance, // Geliri borçlandır (kapama)
            credit: 0,
            description: 'Dönem kapanış - Gelir hesabı',
          })
        }
      }

      // Gider hesaplarını kapat
      for (const account of accounts || []) {
        if (account.type === 'expense' && Math.abs(account.balance) > 0.01) {
          lines.push({
            journal_entry_id: closingEntry.id,
            account_id: account.id,
            debit: 0,
            credit: account.balance, // Gideri alacaklandır (kapama)
            description: 'Dönem kapanış - Gider hesabı',
          })
        }
      }

      // Net kar/zarar kaydı
      if (netIncome > 0) {
        // Kar
        lines.push({
          journal_entry_id: closingEntry.id,
          account_id: targetAccount.id,
          debit: 0,
          credit: netIncome,
          description: 'Dönem Net Karı',
        })
      } else if (netIncome < 0) {
        // Zarar
        lines.push({
          journal_entry_id: closingEntry.id,
          account_id: targetAccount.id,
          debit: Math.abs(netIncome),
          credit: 0,
          description: 'Dönem Net Zararı',
        })
      }

      // Satırları ekle
      if (lines.length > 0) {
        const { error: linesError } = await supabase
          .from('journal_entry_lines')
          .insert(lines)

        if (linesError) throw linesError
      }

      return { netIncome, entryNumber }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['account_balances'] })
      const incomeText =
        data.netIncome > 0
          ? `₺${data.netIncome.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} KAR`
          : `₺${Math.abs(data.netIncome).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ZARAR`
      toast.success(
        `Dönem başarıyla kapatıldı! ${incomeText}. Yevmiye No: ${data.entryNumber}`
      )
      setConfirmText('')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Dönem kapatma başarısız')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    closePeriodMutation.mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Finansal Dönem Kapama
          </h1>
          <Tooltip content="Yıl sonu kapanışı yaparak gelir-gider hesaplarını kapatın ve net kar/zararı özkaynak hesaplarına aktarın. Bu işlem geri alınamaz!" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Dönem Sonu Kapanış İşlemleri
        </p>
      </div>

      {/* Warning Card */}
      <div className="card bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <div className="flex gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
              Önemli Uyarı
            </h3>
            <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
              <li>• Bu işlem GERİ ALINAMAZ</li>
              <li>• Tüm gelir ve gider hesapları kapatılacak</li>
              <li>• Net kar/zarar özkaynak hesabına aktarılacak</li>
              <li>• İşlem öncesi mutlaka yedek alın</li>
              <li>• Tüm kayıtların doğruluğundan emin olun</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Period Close Form */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Dönem Kapanış Bilgileri
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Closing Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kapanış Tarihi *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={closingDate}
                onChange={(e) => setClosingDate(e.target.value)}
                className="input-field !pl-10"
                required
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Genellikle yıl sonu tarihi seçilir (31 Aralık)
            </p>
          </div>

          {/* Info Panel */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              İşlem Adımları
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Tüm gelir hesapları (6xx) borçlandırılacak</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Tüm gider hesapları (7xx) alacaklandırılacak</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Net kar 590 - DÖNEM NET KARI hesabına aktarılacak</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Net zarar 591 - DÖNEM NET ZARARI hesabına aktarılacak</span>
              </li>
            </ol>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Onay için "KAPAT" yazın *
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="KAPAT"
              className="input-field"
              required
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Bu işlemin geri alınamayacağını anladığınızı onaylayın
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={closePeriodMutation.isPending || confirmText !== 'KAPAT'}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-5 h-5" />
              {closePeriodMutation.isPending ? 'Dönem Kapatılıyor...' : 'Dönemi Kapat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
