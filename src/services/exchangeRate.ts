import { supabase } from '@/lib/supabase'

interface TCMBRate {
  code: string
  name: string
  buying: number
  selling: number
  effectiveBuying?: number
  effectiveSelling?: number
}

interface ExchangeRate {
  currency_code: string
  buy_rate: number
  sell_rate: number
  effective_date: string
  source: string
}

/**
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) API'sinden güncel döviz kurlarını çeker
 * Not: TCMB API günde bir kez, saat 15:30'da güncellenir
 * CORS sorunu nedeniyle Vite proxy kullanıyoruz
 */
export const fetchTCMBRates = async (): Promise<TCMBRate[]> => {
  try {
    // Vite proxy (dev) or local container proxy (prod on localhost)
    const isDev = import.meta.env.DEV
    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    const url =
      isDev || isLocal ? '/api/tcmb' : 'https://www.tcmb.gov.tr/kurlar/today.xml'

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`TCMB API hatası: ${response.status}`)
    }

    const xmlText = await response.text()
    return parseTCMBXML(xmlText)
  } catch (error) {
    console.error('TCMB API error:', error)
    throw new Error('Döviz kurları alınamadı. Lütfen daha sonra tekrar deneyin.')
  }
}

/**
 * TCMB XML formatını parse eder
 */
function parseTCMBXML(xmlText: string): TCMBRate[] {
  const rates: TCMBRate[] = []

  // Regex ile XML parse et
  const currencyMatches = xmlText.matchAll(/<Currency[^>]*>([\s\S]*?)<\/Currency>/g)

  for (const match of currencyMatches) {
    const currencyBlock = match[1]

    // Currency code
    const codeMatch = match[0].match(/(?:CurrencyCode|Kod)="([^"]+)"/)
    const code = codeMatch?.[1]
    if (!code) continue

    // Name
    const nameMatch = currencyBlock.match(/<(?:CurrencyName|Isim)>([^<]+)</)
    const name = nameMatch?.[1] || code

    // Buying rate
    const buyingMatch = currencyBlock.match(/<(?:ForexBuying|ForexAlıs)>([^<]+)</)
    const buying = parseFloat(buyingMatch?.[1] || '0')

    // Selling rate
    const sellingMatch = currencyBlock.match(/<(?:ForexSelling|ForexSatıs)>([^<]+)</)
    const selling = parseFloat(sellingMatch?.[1] || '0')

    if (buying > 0 && selling > 0) {
      rates.push({
        code,
        name,
        buying,
        selling,
      })
    }
  }

  return rates
}

/**
 * Döviz kurlarını veritabanına kaydeder
 */
export const saveExchangeRates = async (userId: string, rates: TCMBRate[]): Promise<void> => {
  const today = new Date().toISOString().split('T')[0]

  for (const rate of rates) {
    if (rate.buying === 0 || rate.selling === 0) continue

    // Önce bugünkü kuru kontrol et
    const { data: existing } = await supabase
      .from('exchange_rates')
      .select('id')
      .eq('user_id', userId)
      .eq('currency_code', rate.code)
      .eq('effective_date', today)
      .single()

    const payload = {
      user_id: userId,
      currency_code: rate.code,
      buy_rate: rate.buying,
      sell_rate: rate.selling,
      effective_date: today,
      source: 'TCMB',
    }

    if (existing) {
      // Güncelle
      await supabase
        .from('exchange_rates')
        .update(payload)
        .eq('id', existing.id)
    } else {
      // Yeni kayıt
      await supabase
        .from('exchange_rates')
        .insert(payload)
    }
  }
}

/**
 * Güncel döviz kurlarını getir (önce DB'den, yoksa TCMB'den çek)
 */
export const getLatestRates = async (userId: string): Promise<ExchangeRate[]> => {
  const today = new Date().toISOString().split('T')[0]

  // Önce bugünkü kurları kontrol et
  const { data: dbRates, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('user_id', userId)
    .eq('effective_date', today)
    .order('currency_code')

  if (error) {
    console.error('DB error:', error)
  }

  // Eğer bugünkü kurlar yoksa, TCMB'den çek ve kaydet
  if (!dbRates || dbRates.length === 0) {
    try {
      const tcmbRates = await fetchTCMBRates()
      await saveExchangeRates(userId, tcmbRates)

      // Tekrar veritabanından çek
      const { data: newRates } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('user_id', userId)
        .eq('effective_date', today)
        .order('currency_code')

      return newRates || []
    } catch (error) {
      console.error('TCMB fetch error:', error)

      // TCMB'den çekilemezse, en son kaydedilmiş kurları getir
      const { data: fallbackRates } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('user_id', userId)
        .order('effective_date', { ascending: false })
        .order('currency_code')
        .limit(10)

      return fallbackRates || []
    }
  }

  return dbRates
}

/**
 * Para birimi çevirme
 */
export const convertCurrency = async (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  userId: string
): Promise<number> => {
  if (fromCurrency === toCurrency) return amount

  const rates = await getLatestRates(userId)

  // TRY'den başka bir para birimine
  if (fromCurrency === 'TRY') {
    const toRate = rates.find(r => r.currency_code === toCurrency)
    if (!toRate) throw new Error(`${toCurrency} kuru bulunamadı`)
    return amount / toRate.sell_rate
  }

  // Başka bir para biriminden TRY'ye
  if (toCurrency === 'TRY') {
    const fromRate = rates.find(r => r.currency_code === fromCurrency)
    if (!fromRate) throw new Error(`${fromCurrency} kuru bulunamadı`)
    return amount * fromRate.buy_rate
  }

  // İki yabancı para birimi arası
  const fromRate = rates.find(r => r.currency_code === fromCurrency)
  const toRate = rates.find(r => r.currency_code === toCurrency)

  if (!fromRate || !toRate) {
    throw new Error('Döviz kurları bulunamadı')
  }

  // Önce TRY'ye çevir, sonra hedef para birimine
  const inTRY = amount * fromRate.buy_rate
  return inTRY / toRate.sell_rate
}
