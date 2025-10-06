import { Link } from 'react-router-dom'
import {
  FileText,
  Scale,
  PieChart,
  TrendingUp,
  Calendar,
  Receipt,
  BarChart3,
} from 'lucide-react'
import Tooltip from '@/components/Tooltip'

interface ReportCard {
  title: string
  description: string
  icon: React.ElementType
  path: string
  color: string
  tooltip: string
}

const reports: ReportCard[] = [
  {
    title: 'Bilanço',
    description: 'Şirketin finansal durumunu gösteren bilanço raporu',
    icon: Scale,
    path: '/reports/balance-sheet',
    color: 'blue',
    tooltip: 'Aktif (varlıklar) ve pasif (kaynaklar) hesaplarınızın detaylı dökümü. Excel\'e aktarabilir ve yazdırabilirsiniz.',
  },
  {
    title: 'Mizan',
    description: 'Hesapların borç-alacak toplamları (Trial Balance)',
    icon: BarChart3,
    path: '/reports/trial-balance',
    color: 'green',
    tooltip: 'Tüm hesapların borç ve alacak toplamları. Muhasebe kayıtlarınızın doğruluğunu kontrol edin.',
  },
  {
    title: 'Gelir Tablosu',
    description: 'Dönem gelir ve giderleri analizi',
    icon: TrendingUp,
    path: '/reports/income-statement',
    color: 'purple',
    tooltip: 'Belirli bir dönemdeki gelir ve giderlerinizi görüntüleyin. Net kar/zarar ve kar marjı hesaplaması yapılır.',
  },
  {
    title: 'Cari Hesap Özeti',
    description: 'Müşteri bazlı alacak-borç raporu',
    icon: FileText,
    path: '/reports/customer-account-summary',
    color: 'orange',
    tooltip: 'Müşteri bazında alacak ve borçlarınızı takip edin. Ödeme oranlarını ve bakiyeleri görün.',
  },
  {
    title: 'KDV Beyannamesi',
    description: 'Dönem KDV hesaplamaları',
    icon: Receipt,
    path: '/reports/vat-declaration',
    color: 'red',
    tooltip: 'Satış ve alış KDV tutarlarınızı oran bazında görüntüleyin (%1, %8, %10, %18). Ödenecek/indirilecek KDV hesaplaması.',
  },
  {
    title: 'Yaşlandırma Analizi',
    description: 'Vadesi geçmiş alacakların analizi',
    icon: Calendar,
    path: '/reports/aging-analysis',
    color: 'yellow',
    tooltip: 'Vadesi geçmiş alacakları vade aralıklarına göre (0-30, 31-60, 61-90, 90+ gün) analiz edin. Risk değerlendirmesi yapın.',
  },
]

export default function ReportsHub() {
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; hover: string }> = {
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-900/20',
        icon: 'text-blue-600 dark:text-blue-400',
        hover: 'hover:bg-blue-50 dark:hover:bg-blue-900/30',
      },
      green: {
        bg: 'bg-green-100 dark:bg-green-900/20',
        icon: 'text-green-600 dark:text-green-400',
        hover: 'hover:bg-green-50 dark:hover:bg-green-900/30',
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-900/20',
        icon: 'text-purple-600 dark:text-purple-400',
        hover: 'hover:bg-purple-50 dark:hover:bg-purple-900/30',
      },
      orange: {
        bg: 'bg-orange-100 dark:bg-orange-900/20',
        icon: 'text-orange-600 dark:text-orange-400',
        hover: 'hover:bg-orange-50 dark:hover:bg-orange-900/30',
      },
      red: {
        bg: 'bg-red-100 dark:bg-red-900/20',
        icon: 'text-red-600 dark:text-red-400',
        hover: 'hover:bg-red-50 dark:hover:bg-red-900/30',
      },
      yellow: {
        bg: 'bg-yellow-100 dark:bg-yellow-900/20',
        icon: 'text-yellow-600 dark:text-yellow-400',
        hover: 'hover:bg-yellow-50 dark:hover:bg-yellow-900/30',
      },
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Raporlar
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Finansal raporlar ve analizler
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon
          const colors = getColorClasses(report.color)
          const isComingSoon = report.path === '#'

          const content = (
            <>
              <div className={`p-4 rounded-lg ${colors.bg}`}>
                <Icon className={`w-8 h-8 ${colors.icon}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  {report.title}
                  <Tooltip content={report.tooltip} />
                  {isComingSoon && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      Yakında
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {report.description}
                </p>
              </div>
            </>
          )

          if (isComingSoon) {
            return (
              <div
                key={report.title}
                className="card flex items-start gap-4 opacity-60 cursor-not-allowed"
              >
                {content}
              </div>
            )
          }

          return (
            <Link
              key={report.title}
              to={report.path}
              className={`card flex items-start gap-4 transition-all ${colors.hover} hover:shadow-lg`}
            >
              {content}
            </Link>
          )
        })}
      </div>

      {/* Info */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <PieChart className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Rapor Merkezi
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Tüm finansal raporlarınıza tek noktadan ulaşabilir, Excel'e aktarabilir
              ve yazdırabilirsiniz. Yeni raporlar yakında eklenecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
