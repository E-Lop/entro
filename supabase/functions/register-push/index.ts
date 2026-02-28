import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubscribeRequest {
  action: 'subscribe' | 'unsubscribe'
  subscription?: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  endpoint?: string
  userAgent?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Autenticare l'utente
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body: SubscribeRequest = await req.json()

    if (body.action === 'subscribe') {
      if (!body.subscription) {
        return new Response(JSON.stringify({ error: 'Subscription data required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Upsert subscription (gestisce re-subscribe dello stesso device)
      const { error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: body.subscription.endpoint,
          p256dh: body.subscription.keys.p256dh,
          auth_key: body.subscription.keys.auth,
          user_agent: body.userAgent || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,endpoint' })

      if (upsertError) throw upsertError

      // Creare notification_preferences con defaults se non esiste
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, enabled: true },
          { onConflict: 'user_id', ignoreDuplicates: true })

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'unsubscribe') {
      const endpoint = body.endpoint || body.subscription?.endpoint
      if (!endpoint) {
        return new Response(JSON.stringify({ error: 'Endpoint required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      await supabase.from('push_subscriptions').delete()
        .eq('user_id', user.id).eq('endpoint', endpoint)

      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
