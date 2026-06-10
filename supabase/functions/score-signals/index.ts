/**
 * Supabase scheduled Edge Function — runs every hour.
 * Fills in eth_price_*_after and outcome_* for signals older than 24h/48h/7d.
 *
 * Schedule via Supabase dashboard → Edge Functions → Add Schedule:
 *   cron: "0 * * * *"   (every hour)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getEthPrice(): Promise<number> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
  const data = await res.json()
  return data.ethereum.usd
}

function computeOutcome(signalType: string, priceThen: number, priceNow: number): string {
  const pct = ((priceNow - priceThen) / priceThen) * 100
  const threshold = 2
  if (signalType === 'BULLISH') {
    if (pct >= threshold) return 'CORRECT'
    if (pct <= -threshold) return 'INCORRECT'
    return 'NEUTRAL'
  }
  if (signalType === 'BEARISH') {
    if (pct <= -threshold) return 'CORRECT'
    if (pct >= threshold) return 'INCORRECT'
    return 'NEUTRAL'
  }
  return 'NEUTRAL'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ethPrice = await getEthPrice()
    const now = new Date()

    // Fetch all pending signals
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .or('outcome_24h.eq.PENDING,outcome_48h.eq.PENDING,outcome_7d.eq.PENDING')

    if (error) throw error

    let updated = 0
    for (const signal of (signals ?? [])) {
      const created = new Date(signal.created_at)
      const ageHours = (now.getTime() - created.getTime()) / 3600000
      const patch: Record<string, unknown> = {}

      if (ageHours >= 24 && signal.outcome_24h === 'PENDING') {
        patch.eth_price_24h_after = ethPrice
        patch.outcome_24h = computeOutcome(signal.signal_type, signal.eth_price_at_signal, ethPrice)
      }
      if (ageHours >= 48 && signal.outcome_48h === 'PENDING') {
        patch.eth_price_48h_after = ethPrice
        patch.outcome_48h = computeOutcome(signal.signal_type, signal.eth_price_at_signal, ethPrice)
      }
      if (ageHours >= 168 && signal.outcome_7d === 'PENDING') {
        patch.eth_price_7d_after = ethPrice
        patch.outcome_7d = computeOutcome(signal.signal_type, signal.eth_price_at_signal, ethPrice)
      }

      if (Object.keys(patch).length > 0) {
        await supabase.from('signals').update(patch).eq('id', signal.id)
        updated++
      }
    }

    return new Response(JSON.stringify({ success: true, updated, eth_price: ethPrice }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
