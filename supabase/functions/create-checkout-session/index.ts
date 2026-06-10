import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Server misconfigured: missing Supabase service credentials')
    }
    if (!stripeKey) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in Supabase Edge Function secrets.')
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Not signed in — refresh the page and try again')

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
    if (authError || !user) throw new Error('Unauthorized — sign in again')

    let billing = 'monthly'
    try {
      const body = await req.json()
      if (body?.billing === 'annual') billing = 'annual'
    } catch {
      // empty body is fine — default monthly
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

    const PRICE_MONTHLY = Deno.env.get('STRIPE_PRICE_MONTHLY') || 'price_1Tgh7TJ99lPC7hJArhlkMRUt'
    const PRICE_ANNUAL = Deno.env.get('STRIPE_PRICE_ANNUAL') || 'price_1Tgh7TJ99lPC7hJAKI7D5KIg'
    const priceId = billing === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY
    const appUrl = Deno.env.get('APP_URL') || 'https://hadaleum.com'

    // Ensure profile exists (trigger should create it; upsert covers edge cases)
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      plan: 'free',
    }, { onConflict: 'id' })

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) throw new Error(`Profile error: ${profileError.message}`)

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      if (updateError) throw new Error(`Could not save Stripe customer: ${updateError.message}`)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${appUrl}/watchlist?upgraded=1`,
      cancel_url: `${appUrl}/upgrade`,
      allow_promotion_codes: true,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')

    return jsonResponse({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed'
    console.error('create-checkout-session error:', message)
    return jsonResponse({ error: message }, 500)
  }
})
