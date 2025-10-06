import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

interface TCMBRate {
  code: string
  name: string
  buying: number
  selling: number
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // TCMB today.xml kullan (her zaman güncel)
    const url = 'https://www.tcmb.gov.tr/kurlar/today.xml'
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`TCMB API hatası: ${response.status}`)
    }

    const xmlText = await response.text()
    const rates = parseTCMBXML(xmlText)

    // Tarih bilgisini XML'den çek
    const dateMatch = xmlText.match(/Tarih="([^"]+)"/)
    const dateStr = dateMatch?.[1] || new Date().toISOString().split('T')[0]

    return new Response(JSON.stringify({ rates, date: dateStr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('TCMB fetch error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'TCMB kurları alınamadı' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

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
