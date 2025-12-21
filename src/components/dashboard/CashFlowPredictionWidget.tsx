import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { TrendingUp, TrendingDown, DollarSign, Loader2, AlertCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PredictionData {
  date: string
  predicted_amount: number
  confidence: number
}

interface CashFlowPrediction {
  predictions: PredictionData[]
  total_predicted_cash_flow: number
  trend: 'up' | 'down' | 'stable'
}

export default function CashFlowPredictionWidget() {
  const { settings } = useSettings()

  const { data: prediction, isLoading, error } = useQuery<CashFlowPrediction>({
    queryKey: ['cash-flow-prediction'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-predictions', {
        body: {
          prediction_type: 'cash_flow',
          time_period: 'next_30_days',
        },
      })

      if (error) throw error
      return data
    },
    enabled: !!settings?.ai_predictions_enabled && !!settings?.openai_api_key_set,
    refetchOnWindowFocus: false,
  })

  // Don't show if feature is disabled
  if (!settings?.ai_predictions_enabled || !settings?.openai_api_key_set) {
    return null
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Nakit Akışı Tahmini (30 Gün)
          </h2>
        </div>
        {prediction?.trend && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full ${
            prediction.trend === 'up'
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : prediction.trend === 'down'
              ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
          }`}>
            {prediction.trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : prediction.trend === 'down' ? (
              <TrendingDown className="w-4 h-4" />
            ) : null}
            <span className="text-sm font-medium capitalize">{prediction.trend}</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">
            Tahmin yüklenirken hata oluştu
          </p>
        </div>
      )}

      {prediction && !isLoading && !error && (
        <>
          {/* Total Prediction */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Tahmini Toplam Nakit Akışı
            </p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ₺{prediction.total_predicted_cash_flow.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
          </div>

          {/* Prediction Chart */}
          {prediction.predictions && prediction.predictions.length > 0 && (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={prediction.predictions}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getDate()}/${date.getMonth() + 1}`
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [
                    `₺${value.toLocaleString('tr-TR')}`,
                    'Tahmin'
                  ]}
                  labelFormatter={(label) => {
                    const date = new Date(label)
                    return date.toLocaleDateString('tr-TR')
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted_amount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Tahmini Nakit"
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            AI tarafından geçmiş verilerinize göre oluşturulmuştur
          </p>
        </>
      )}
    </div>
  )
}
