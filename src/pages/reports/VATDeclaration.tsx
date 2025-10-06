import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Download, Printer, Calendar, Receipt } from 'lucide-react'
import { exportToExcel } from '@/lib/excelExport'
import toast from 'react-hot-toast'
import Tooltip from '@/components/Tooltip'

interface VATData {
  sales: {
    rate18: number
    rate10: number
    rate8: number
    rate1: number
    totalBase: number
    totalVAT: number
  }
  purchases: {
    rate18: number
    rate10: number
    rate8: number
    rate1: number
    totalBase: number
    totalVAT: number
  }
  payable: number
}

export default function VATDeclaration() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    date.setDate(1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    date.setDate(0) // Son gün
    return date.toISOString().split('T')[0]
  })

  const { data, isLoading } = useQuery({
    queryKey: ['vat-declaration', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user) return null

      // Satış KDV'si (Faturalardan)
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_items(quantity, unit_price, tax_rate)')
        .eq('user_id', user.id)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .in('status', ['sent', 'paid'])

      const salesVAT = {
        rate18: 0,
        rate10: 0,
        rate8: 0,
        rate1: 0,
      }

      invoices?.forEach(inv => {
        inv.invoice_items?.forEach(item => {
          const base = (item.quantity || 0) * (item.unit_price || 0)
          const rate = item.tax_rate || 0

          if (rate === 18) salesVAT.rate18 += base * 0.18
          else if (rate === 10) salesVAT.rate10 += base * 0.10
          else if (rate === 8) salesVAT.rate8 += base * 0.08
          else if (rate === 1) salesVAT.rate1 += base * 0.01
        })
      })

      // Alış KDV'si (Giderlerden - basitleştirilmiş)
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('user_id', user.id)
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .eq('status', 'approved')

      const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0
      // Giderlerin %18 KDV içerdiğini varsayalım (basitleştirilmiş)
      const purchasesVAT = {
        rate18: totalExpenses * 0.18 / 1.18,
        rate10: 0,
        rate8: 0,
        rate1: 0,
      }

      const salesTotal = salesVAT.rate18 + salesVAT.rate10 + salesVAT.rate8 + salesVAT.rate1
      const purchasesTotal = purchasesVAT.rate18 + purchasesVAT.rate10 + purchasesVAT.rate8 + purchasesVAT.rate1

      return {
        sales: {
          ...salesVAT,
          totalBase: salesTotal / 0.18, // Ortalama
          totalVAT: salesTotal,
        },
        purchases: {
          ...purchasesVAT,
          totalBase: purchasesTotal / 0.18,
          totalVAT: purchasesTotal,
        },
        payable: salesTotal - purchasesTotal,
      } as VATData
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
      { Kategori: 'Hesaplanan KDV', Kalem: '%18', Tutar: data.sales.rate18.toFixed(2) },
      { Kategori: 'Hesaplanan KDV', Kalem: '%10', Tutar: data.sales.rate10.toFixed(2) },
      { Kategori: 'Hesaplanan KDV', Kalem: '%8', Tutar: data.sales.rate8.toFixed(2) },
      { Kategori: 'Hesaplanan KDV', Kalem: '%1', Tutar: data.sales.rate1.toFixed(2) },
      { Kategori: 'Hesaplanan KDV', Kalem: 'Toplam', Tutar: data.sales.totalVAT.toFixed(2) },
      { Kategori: 'İndirilecek KDV', Kalem: '%18', Tutar: data.purchases.rate18.toFixed(2) },
      { Kategori: 'İndirilecek KDV', Kalem: '%10', Tutar: data.purchases.rate10.toFixed(2) },
      { Kategori: 'İndirilecek KDV', Kalem: '%8', Tutar: data.purchases.rate8.toFixed(2) },
      { Kategori: 'İndirilecek KDV', Kalem: '%1', Tutar: data.purchases.rate1.toFixed(2) },
      { Kategori: 'İndirilecek KDV', Kalem: 'Toplam', Tutar: data.purchases.totalVAT.toFixed(2) },
      { Kategori: 'Özet', Kalem: 'Ödenecek/Devredilecek KDV', Tutar: data.payable.toFixed(2) },
    ]

    exportToExcel(excelData, 'KDV_Beyannamesi', `kdv-beyani-${startDate}`)
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
              KDV Beyannamesi
            </h1>
            <Tooltip content="Dönemsel KDV hesaplamaları. Satışlardan hesaplanan KDV ile alışlardan indirilecek KDV'yi görüntüleyin. Ödenecek veya devredilecek KDV tutarını hesaplayın." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            VAT Declaration - Dönem KDV Hesaplama
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
          {/* Summary Card */}
          <div className={`card ${
            data.payable >= 0
              ? 'bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-slate-800 border-2 border-red-200 dark:border-red-800'
              : 'bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-slate-800 border-2 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-2xl font-bold mb-2 ${
                  data.payable >= 0
                    ? 'text-red-900 dark:text-red-100'
                    : 'text-green-900 dark:text-green-100'
                }`}>
                  {data.payable >= 0 ? 'Ödenecek KDV' : 'Devredilecek KDV'}
                </h3>
                <p className={`text-sm ${
                  data.payable >= 0
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-green-700 dark:text-green-300'
                }`}>
                  {data.payable >= 0 ? 'Hazineye ödenecek tutar' : 'Sonraki döneme devredecek tutar'}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-4xl font-bold ${
                  data.payable >= 0
                    ? 'text-red-900 dark:text-red-100'
                    : 'text-green-900 dark:text-green-100'
                }`}>
                  ₺{Math.abs(data.payable).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hesaplanan KDV (Satış) */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                Hesaplanan KDV (Satış)
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%18 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.sales.rate18.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%10 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.sales.rate10.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%8 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.sales.rate8.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%1 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.sales.rate1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <span className="font-bold text-green-900 dark:text-green-100">
                    Toplam Hesaplanan KDV
                  </span>
                  <span className="text-xl font-bold text-green-900 dark:text-green-100">
                    ₺{data.sales.totalVAT.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* İndirilecek KDV (Alış) */}
            <div className="card">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                İndirilecek KDV (Alış)
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%18 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.purchases.rate18.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%10 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.purchases.rate10.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%8 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.purchases.rate8.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-gray-700 dark:text-gray-300">%1 KDV</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    ₺{data.purchases.rate1.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <span className="font-bold text-blue-900 dark:text-blue-100">
                    Toplam İndirilecek KDV
                  </span>
                  <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    ₺{data.purchases.totalVAT.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="card bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <Receipt className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  Önemli Not
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Bu rapor bilgilendirme amaçlıdır. Resmi KDV beyannamesi için mali müşavirinize
                  danışın. Gider KDV'si basitleştirilmiş olarak hesaplanmıştır.
                </p>
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
