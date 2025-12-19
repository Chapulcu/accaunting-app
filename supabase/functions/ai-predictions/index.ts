// AI Predictions Edge Function
// Generates financial predictions (cash flow, revenue, payment probability)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PredictionRequest {
  prediction_type: 'cash_flow' | 'revenue' | 'payment_probability' | 'anomaly'
  target_entity_type?: string
  target_entity_id?: number
  forecast_days?: number
  historical_data?: any
}

interface PredictionResult {
  prediction_type: string
  prediction_data: any
  confidence_score: number
  model_version: string
  created_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if AI predictions are enabled
    const { data: settings } = await supabaseClient
      .from('app_settings')
      .select('ai_predictions_enabled, openai_api_key_set')
      .limit(1)
      .single()

    if (!settings?.ai_predictions_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI predictions feature is not enabled' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const predictionRequest: PredictionRequest = await req.json()

    if (!predictionRequest.prediction_type) {
      throw new Error('Missing required field: prediction_type')
    }

    let predictionResult: PredictionResult

    switch (predictionRequest.prediction_type) {
      case 'cash_flow':
        predictionResult = await predictCashFlow(
          supabaseClient,
          user.id,
          predictionRequest.forecast_days || 30
        )
        break

      case 'revenue':
        predictionResult = await predictRevenue(
          supabaseClient,
          user.id,
          predictionRequest.forecast_days || 30
        )
        break

      case 'payment_probability':
        predictionResult = await predictPaymentProbability(
          supabaseClient,
          user.id,
          predictionRequest.target_entity_id
        )
        break

      case 'anomaly':
        predictionResult = await detectAnomalies(supabaseClient, user.id)
        break

      default:
        throw new Error(`Unsupported prediction type: ${predictionRequest.prediction_type}`)
    }

    // Save prediction to database
    await supabaseClient.from('ai_predictions').insert({
      user_id: user.id,
      prediction_type: predictionRequest.prediction_type,
      target_entity_type: predictionRequest.target_entity_type,
      target_entity_id: predictionRequest.target_entity_id,
      prediction_data: predictionResult.prediction_data,
      confidence_score: predictionResult.confidence_score,
      model_version: predictionResult.model_version,
      prediction_date: new Date(
        Date.now() + (predictionRequest.forecast_days || 30) * 24 * 60 * 60 * 1000
      ).toISOString(),
    })

    return new Response(JSON.stringify(predictionResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in predictions:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function predictCashFlow(
  supabaseClient: any,
  userId: string,
  forecastDays: number
): Promise<PredictionResult> {
  // Get historical invoice and payment data
  const { data: invoices } = await supabaseClient
    .from('invoices')
    .select('total_amount, status, issue_date, due_date')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false })
    .limit(100)

  const { data: payments } = await supabaseClient
    .from('payments')
    .select('amount, payment_date, payment_method')
    .eq('user_id', userId)
    .order('payment_date', { ascending: false })
    .limit(100)

  // Simple statistical analysis
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0
  const totalPaid = payments?.reduce((sum, pay) => sum + (pay.amount || 0), 0) || 0
  const avgDailyRevenue = totalInvoiced / Math.max(invoices?.length || 1, 30)
  const avgDailyPayments = totalPaid / Math.max(payments?.length || 1, 30)

  // Generate daily predictions
  const dailyPredictions = []
  let cumulativeCashFlow = 0

  for (let day = 1; day <= forecastDays; day++) {
    const predictedRevenue = avgDailyRevenue * (1 + (Math.random() - 0.5) * 0.2) // ±10% variance
    const predictedExpense = avgDailyPayments * (1 + (Math.random() - 0.5) * 0.15) // ±7.5% variance
    const netCashFlow = predictedRevenue - predictedExpense
    cumulativeCashFlow += netCashFlow

    dailyPredictions.push({
      day,
      date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predicted_revenue: Math.round(predictedRevenue * 100) / 100,
      predicted_expense: Math.round(predictedExpense * 100) / 100,
      net_cash_flow: Math.round(netCashFlow * 100) / 100,
      cumulative_cash_flow: Math.round(cumulativeCashFlow * 100) / 100,
    })
  }

  return {
    prediction_type: 'cash_flow',
    prediction_data: {
      forecast_days: forecastDays,
      daily_predictions: dailyPredictions,
      summary: {
        avg_daily_revenue: Math.round(avgDailyRevenue * 100) / 100,
        avg_daily_expense: Math.round(avgDailyPayments * 100) / 100,
        total_predicted_cash_flow: Math.round(cumulativeCashFlow * 100) / 100,
      },
    },
    confidence_score: 65, // Medium confidence for statistical model
    model_version: 'statistical-v1',
    created_at: new Date().toISOString(),
  }
}

async function predictRevenue(
  supabaseClient: any,
  userId: string,
  forecastDays: number
): Promise<PredictionResult> {
  // Get historical revenue data
  const { data: invoices } = await supabaseClient
    .from('invoices')
    .select('total_amount, issue_date, status')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false })
    .limit(90) // Last 90 days

  if (!invoices || invoices.length === 0) {
    return {
      prediction_type: 'revenue',
      prediction_data: {
        forecast_days: forecastDays,
        predicted_revenue: 0,
        daily_average: 0,
      },
      confidence_score: 0,
      model_version: 'statistical-v1',
      created_at: new Date().toISOString(),
    }
  }

  // Calculate trend
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
  const avgDailyRevenue = totalRevenue / Math.max(invoices.length, 30)
  const predictedRevenue = avgDailyRevenue * forecastDays

  return {
    prediction_type: 'revenue',
    prediction_data: {
      forecast_days: forecastDays,
      predicted_revenue: Math.round(predictedRevenue * 100) / 100,
      daily_average: Math.round(avgDailyRevenue * 100) / 100,
      historical_avg: Math.round(avgDailyRevenue * 100) / 100,
      confidence_interval: {
        lower: Math.round(predictedRevenue * 0.85 * 100) / 100,
        upper: Math.round(predictedRevenue * 1.15 * 100) / 100,
      },
    },
    confidence_score: 70,
    model_version: 'statistical-v1',
    created_at: new Date().toISOString(),
  }
}

async function predictPaymentProbability(
  supabaseClient: any,
  userId: string,
  invoiceId?: number
): Promise<PredictionResult> {
  if (!invoiceId) {
    throw new Error('invoice_id is required for payment probability prediction')
  }

  // Get invoice details
  const { data: invoice } = await supabaseClient
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single()

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  // Get customer payment history
  const { data: customerInvoices } = await supabaseClient
    .from('invoices')
    .select('status, due_date, issue_date')
    .eq('user_id', userId)
    .eq('customer_id', invoice.customer_id)

  // Calculate payment probability based on historical data
  let probability = 75 // Base probability

  if (customerInvoices && customerInvoices.length > 0) {
    const paidOnTime = customerInvoices.filter(
      (inv) => inv.status === 'paid' || inv.status === 'completed'
    ).length
    const paymentRate = (paidOnTime / customerInvoices.length) * 100
    probability = Math.min(95, Math.max(20, paymentRate))
  }

  // Adjust based on days until due
  const daysUntilDue = invoice.due_date
    ? Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 30

  if (daysUntilDue < 0) {
    probability *= 0.7 // Overdue reduces probability
  } else if (daysUntilDue < 7) {
    probability *= 0.9 // Due soon, slight reduction
  }

  return {
    prediction_type: 'payment_probability',
    prediction_data: {
      invoice_id: invoiceId,
      payment_probability: Math.round(probability * 100) / 100,
      days_until_due: daysUntilDue,
      risk_level: probability > 80 ? 'low' : probability > 50 ? 'medium' : 'high',
      recommendations:
        probability < 70
          ? ['Consider sending a payment reminder', 'Review payment terms with customer']
          : ['Payment likely to be received on time'],
    },
    confidence_score: 60,
    model_version: 'statistical-v1',
    created_at: new Date().toISOString(),
  }
}

async function detectAnomalies(supabaseClient: any, userId: string): Promise<PredictionResult> {
  // Get recent transactions
  const { data: invoices } = await supabaseClient
    .from('invoices')
    .select('total_amount, issue_date')
    .eq('user_id', userId)
    .order('issue_date', { ascending: false })
    .limit(50)

  if (!invoices || invoices.length < 10) {
    return {
      prediction_type: 'anomaly',
      prediction_data: {
        anomalies: [],
        message: 'Insufficient data for anomaly detection',
      },
      confidence_score: 0,
      model_version: 'statistical-v1',
      created_at: new Date().toISOString(),
    }
  }

  // Calculate statistics
  const amounts = invoices.map((inv) => inv.total_amount || 0)
  const mean = amounts.reduce((sum, val) => sum + val, 0) / amounts.length
  const variance =
    amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length
  const stdDev = Math.sqrt(variance)

  // Detect anomalies (values > 2 standard deviations from mean)
  const anomalies = invoices
    .filter((inv) => {
      const zScore = Math.abs((inv.total_amount - mean) / stdDev)
      return zScore > 2
    })
    .map((inv) => ({
      invoice_id: inv.id,
      amount: inv.total_amount,
      issue_date: inv.issue_date,
      z_score: Math.abs((inv.total_amount - mean) / stdDev),
      deviation: Math.abs(inv.total_amount - mean),
    }))

  return {
    prediction_type: 'anomaly',
    prediction_data: {
      anomalies,
      statistics: {
        mean: Math.round(mean * 100) / 100,
        std_dev: Math.round(stdDev * 100) / 100,
        threshold: Math.round((mean + 2 * stdDev) * 100) / 100,
      },
      total_anomalies: anomalies.length,
    },
    confidence_score: 75,
    model_version: 'statistical-v1',
    created_at: new Date().toISOString(),
  }
}
