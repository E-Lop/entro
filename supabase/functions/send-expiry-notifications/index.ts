import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ApplicationServer, importVapidKeys } from '@negrel/webpush'
import type { PushSubscription as WebPushSubscription } from '@negrel/webpush'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth: verifica shared secret (CRON_SECRET) impostato via Vault + Edge Function secrets
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  if (!cronSecret || token !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Inizializzare Web Push con VAPID keys (JWK format)
    const vapidKeysJson = JSON.parse(Deno.env.get('VAPID_KEYS') ?? '{}')
    const vapidKeys = await importVapidKeys(vapidKeysJson)
    const appServer = await ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@entroapp.it',
      vapidKeys,
    })

    // 1. Ottenere alimenti che necessitano notifica oggi
    const { data: expiringFoods, error: queryError } = await supabase
      .rpc('get_expiring_foods_for_notifications')

    if (queryError) throw queryError
    if (!expiringFoods || expiringFoods.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Raggruppare per utente
    const userFoods = new Map<string, typeof expiringFoods>()
    for (const food of expiringFoods) {
      const existing = userFoods.get(food.user_id) || []
      existing.push(food)
      userFoods.set(food.user_id, existing)
    }

    let totalSent = 0
    const staleEndpoints: string[] = []

    // 3. Per ogni utente, inviare notifica a tutti i device
    for (const [userId, foods] of userFoods) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions').select('*').eq('user_id', userId)

      if (!subscriptions || subscriptions.length === 0) continue

      // Comporre messaggio in italiano
      const expiredToday = foods.filter((f: { days_until_expiry: number }) => f.days_until_expiry === 0)
      const expiringTomorrow = foods.filter((f: { days_until_expiry: number }) => f.days_until_expiry === 1)
      const expiringSoon = foods.filter((f: { days_until_expiry: number }) => f.days_until_expiry > 1)

      let title: string
      let body: string

      if (expiredToday.length > 0) {
        title = expiredToday.length <= 2 ? 'Scadenza oggi!' : `${expiredToday.length} alimenti scadono oggi!`
        body = expiredToday.length <= 2
          ? expiredToday.map((f: { food_name: string }) => f.food_name).join(', ')
          : expiredToday.slice(0, 3).map((f: { food_name: string }) => f.food_name).join(', ') + '...'
      } else if (expiringTomorrow.length > 0) {
        title = 'Scadenza domani'
        body = expiringTomorrow.map((f: { food_name: string }) => f.food_name).join(', ')
      } else {
        const first = expiringSoon[0]
        title = `${expiringSoon.length} aliment${expiringSoon.length === 1 ? 'o' : 'i'} in scadenza`
        body = `${first.food_name} scade tra ${first.days_until_expiry} giorni`
        if (expiringSoon.length > 1) body += ` (+${expiringSoon.length - 1} altr${expiringSoon.length - 1 === 1 ? 'o' : 'i'})`
      }

      const payload = JSON.stringify({
        title, body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/favicon-32x32.png',
        tag: `entro-expiry-${new Date().toISOString().split('T')[0]}`,
        data: { url: '/?status=expiring_soon', type: 'expiry' },
      })

      for (const sub of subscriptions) {
        try {
          const pushSub: WebPushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          }
          const subscriber = appServer.subscribe(pushSub)
          await subscriber.pushTextMessage(payload, {})
          totalSent++
        } catch (error: unknown) {
          const pushErr = error as { statusCode?: number; isGone?: () => boolean }
          if (pushErr.isGone?.() || pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            staleEndpoints.push(sub.endpoint)
          } else {
            console.error('Push send error:', error)
          }
        }
      }

      // Aggiornare contatore rate limiting (incrementale, non sovrascrittura)
      const today = new Date().toISOString().split('T')[0]
      const { data: currentPrefs } = await supabase
        .from('notification_preferences')
        .select('notifications_sent_today, notifications_sent_date')
        .eq('user_id', userId)
        .single()

      const existingCount = currentPrefs?.notifications_sent_date === today
        ? (currentPrefs?.notifications_sent_today ?? 0)
        : 0

      await supabase.from('notification_preferences').update({
        last_notification_sent_at: new Date().toISOString(),
        notifications_sent_today: existingCount + foods.length,
        notifications_sent_date: today,
      }).eq('user_id', userId)
    }

    // 4. Cleanup subscription stale (410 Gone)
    for (const endpoint of staleEndpoints) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent, staleRemoved: staleEndpoints.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Cron job error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
