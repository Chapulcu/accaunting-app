import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { RefreshCw, TrendingUp, DollarSign, Calendar, Search, Grid3x3, List, ArrowUpDown } from 'lucide-react'
import { fetchTCMBRates, saveExchangeRates, getLatestRates } from '@/services/exchangeRate'
import Tooltip from '@/components/Tooltip'

type ViewMode = 'grid' | 'list'

export default function ExchangeRates() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: rates, isLoading } = useQuery({
    queryKey: ['exchange-rates', user?.id],
    queryFn: async () => {
      if (!user) return []
      return await getLatestRates(user.id)
    },
    enabled: !!user,
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Kullanıcı bulunamadı')
      setIsUpdating(true)

      const tcmbRates = await fetchTCMBRates()
      await saveExchangeRates(user.id, tcmbRates)
    },
    onSuccess: () => {
      toast.success('Döviz kurları güncellendi')
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] })
      setIsUpdating(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Kurlar güncellenirken hata oluştu')
      setIsUpdating(false)
    },
  })

  const handleUpdateRates = () => {
    updateMutation.mutate()
  }

  const latestDate = rates && rates.length > 0 ? rates[0].effective_date : null

  // Filtreleme
  const filteredRates = rates?.filter((rate) => {
    const query = searchQuery.toLowerCase()
    const currencyName = getCurrencyName(rate.currency_code).toLowerCase()
    const code = rate.currency_code.toLowerCase()
    return code.includes(query) || currencyName.includes(query)
  }) || []

  // Ana para birimlerini ayır
  const mainCurrencies = ['USD', 'EUR', 'GBP']
  const mainRates = filteredRates.filter((r) => mainCurrencies.includes(r.currency_code))
  const otherRates = filteredRates.filter((r) => !mainCurrencies.includes(r.currency_code))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Döviz Kurları
            </h1>
            <Tooltip content="TCMB'den güncel döviz kurlarını çekebilir, kayıt edebilir ve görüntüleyebilirsiniz. Kurlar her iş günü saat 15:30'da güncellenir." />
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            TCMB güncel döviz kurları
          </p>
        </div>
        <button
          onClick={handleUpdateRates}
          disabled={isUpdating}
          className="btn-primary"
        >
          <RefreshCw className={`w-5 h-5 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Güncelleniyor...' : 'Kurları Güncelle'}
        </button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Para birimi ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
            title="Grid görünümü"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
            title="Liste görünümü"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Card */}
      {latestDate && (
        <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Son Güncelleme
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                {new Date(latestDate).toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : rates && rates.length > 0 ? (
        <div className="space-y-6">
          {/* Ana Para Birimleri - Özel Tasarım */}
          {mainRates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Ana Para Birimleri
                </h2>
                <Tooltip content="En çok kullanılan para birimleri: USD, EUR, GBP. Spread (alış-satış farkı) yüzdeleri ile birlikte gösterilir." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {mainRates.map((rate) => {
                  const flag = getCurrencyFlag(rate.currency_code)
                  const currencyName = getCurrencyName(rate.currency_code)
                  const spread = rate.sell_rate - rate.buy_rate
                  const spreadPercent = ((spread / rate.buy_rate) * 100).toFixed(2)

                  return (
                    <div
                      key={rate.currency_code}
                      className="card bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-slate-800 border-2 border-primary-200 dark:border-primary-800"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="text-5xl">{flag}</div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                              {rate.currency_code}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {currencyName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-green-100 dark:bg-green-900/30 rounded-xl">
                          <div>
                            <span className="text-xs font-medium text-green-700 dark:text-green-300 block mb-1">
                              ALIŞ
                            </span>
                            <span className="text-2xl font-bold text-green-900 dark:text-green-100">
                              ₺{rate.buy_rate.toFixed(4)}
                            </span>
                          </div>
                          <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>

                        <div className="flex justify-between items-center p-4 bg-red-100 dark:bg-red-900/30 rounded-xl">
                          <div>
                            <span className="text-xs font-medium text-red-700 dark:text-red-300 block mb-1">
                              SATIŞ
                            </span>
                            <span className="text-2xl font-bold text-red-900 dark:text-red-100">
                              ₺{rate.sell_rate.toFixed(4)}
                            </span>
                          </div>
                          <ArrowUpDown className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>

                        <div className="pt-3 border-t-2 border-gray-200 dark:border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Spread
                            </span>
                            <div className="text-right">
                              <span className="text-lg font-bold text-gray-900 dark:text-white block">
                                ₺{spread.toFixed(4)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                %{spreadPercent}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Diğer Para Birimleri */}
          {otherRates.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Diğer Para Birimleri
                </h2>
                <Tooltip content="Tüm döviz kurları. Grid veya liste görünümü arasında geçiş yapabilir, arama yapabilirsiniz." />
              </div>

              {/* Grid View */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {otherRates.map((rate) => {
                    const flag = getCurrencyFlag(rate.currency_code)
                    const currencyName = getCurrencyName(rate.currency_code)

                    return (
                      <div key={rate.currency_code} className="card hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-3xl">{flag}</div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                              {rate.currency_code}
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {currencyName}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">
                              Alış
                            </span>
                            <span className="text-sm font-bold text-green-900 dark:text-green-100">
                              ₺{rate.buy_rate.toFixed(4)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <span className="text-xs font-medium text-red-700 dark:text-red-300">
                              Satış
                            </span>
                            <span className="text-sm font-bold text-red-900 dark:text-red-100">
                              ₺{rate.sell_rate.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700">
                          <th className="text-left p-4 font-semibold text-gray-900 dark:text-white">
                            Para Birimi
                          </th>
                          <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                            Alış
                          </th>
                          <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                            Satış
                          </th>
                          <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                            Fark
                          </th>
                          <th className="text-right p-4 font-semibold text-gray-900 dark:text-white">
                            Spread %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherRates.map((rate) => {
                          const flag = getCurrencyFlag(rate.currency_code)
                          const currencyName = getCurrencyName(rate.currency_code)
                          const spread = rate.sell_rate - rate.buy_rate
                          const spreadPercent = ((spread / rate.buy_rate) * 100).toFixed(2)

                          return (
                            <tr
                              key={rate.currency_code}
                              className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">{flag}</span>
                                  <div>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                      {rate.currency_code}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {currencyName}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-green-700 dark:text-green-400 font-semibold">
                                  ₺{rate.buy_rate.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-red-700 dark:text-red-400 font-semibold">
                                  ₺{rate.sell_rate.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-gray-900 dark:text-white font-medium">
                                  ₺{spread.toFixed(4)}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                <span className="text-gray-600 dark:text-gray-400">
                                  %{spreadPercent}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="card text-center py-12">
          <TrendingUp className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Henüz döviz kuru verisi bulunmuyor
          </p>
          <button onClick={handleUpdateRates} className="btn-primary">
            <RefreshCw className="w-5 h-5 mr-2" />
            Kurları Yükle
          </button>
        </div>
      )}

      {/* Info */}
      <div className="card bg-gray-50 dark:bg-slate-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          ℹ️ Bilgi
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>• TCMB (Türkiye Cumhuriyet Merkez Bankası) resmi kurları kullanılmaktadır</li>
          <li>• Kurlar her iş günü saat 15:30'da güncellenir</li>
          <li>• Hafta sonları ve resmi tatillerde kur güncellenmez</li>
          <li>• "Kurları Güncelle" butonuna basarak en güncel kurları çekebilirsiniz</li>
        </ul>
      </div>
    </div>
  )
}

// Helper functions
const getCurrencyFlag = (code: string): string => {
  const flags: Record<string, string> = {
    USD: '🇺🇸',
    EUR: '🇪🇺',
    GBP: '🇬🇧',
    CHF: '🇨🇭',
    CAD: '🇨🇦',
    AUD: '🇦🇺',
    JPY: '🇯🇵',
    SAR: '🇸🇦',
    SEK: '🇸🇪',
    NOK: '🇳🇴',
    DKK: '🇩🇰',
    RUB: '🇷🇺',
    CNY: '🇨🇳',
    KWD: '🇰🇼',
    AED: '🇦🇪',
  }
  return flags[code] || '🌐'
}

const getCurrencyName = (code: string): string => {
  const names: Record<string, string> = {
    USD: 'Amerikan Doları',
    EUR: 'Euro',
    GBP: 'İngiliz Sterlini',
    CHF: 'İsviçre Frangı',
    CAD: 'Kanada Doları',
    AUD: 'Avustralya Doları',
    JPY: 'Japon Yeni',
    SAR: 'Suudi Arabistan Riyali',
    SEK: 'İsveç Kronu',
    NOK: 'Norveç Kronu',
    DKK: 'Danimarka Kronu',
    RUB: 'Rus Rublesi',
    CNY: 'Çin Yuanı',
    KWD: 'Kuveyt Dinarı',
    AED: 'BAE Dirhemi',
  }
  return names[code] || code
}
