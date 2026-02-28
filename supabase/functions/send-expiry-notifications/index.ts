import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Web Push via VAPID
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<{ success: boolean; statusCode?: number; gone?: boolean }> {
  const webpush = await import('https://esm.sh/web-push@3.6.7')
  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey)

  try {
    const result = await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
      payload
    )
    return { success: true, statusCode: result.statusCode }
  } catch (error: unknown) {
    const pushError = error as { statusCode?: number }
    if (pushError.statusCode === 410 || pushError.statusCode === 404) {
      return { success: false, statusCode: pushError.statusCode, gone: true }
    }
    console.error('Push send error:', error)
    return { success: false, statusCode: pushError.statusCode }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Verificare che sia chiamata dal cron (service_role key)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'NONE')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const vapidKeys = {
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
      subject: Deno.env.get('VAPID_SUBJECT') ?? '',
    }

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
      const expiredToday = foods.filter((f) => f.days_until_expiry === 0)
      const expiringTomorrow = foods.filter((f) => f.days_until_expiry === 1)
      const expiringSoon = foods.filter((f) => f.days_until_expiry > 1)

      let title: string
      let body: string

      if (expiredToday.length > 0) {
        title = expiredToday.length <= 2 ? 'Scadenza oggi!' : `${expiredToday.length} alimenti scadono oggi!`
        body = expiredToday.length <= 2
          ? expiredToday.map((f) => f.food_name).join(', ')
          : expiredToday.slice(0, 3).map((f) => f.food_name).join(', ') + '...'
      } else if (expiringTomorrow.length > 0) {
        title = 'Scadenza domani'
        body = expiringTomorrow.map((f) => f.food_name).join(', ')
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
        const result = await sendWebPush(sub, payload, vapidKeys)
        if (result.success) totalSent++
        else if (result.gone) staleEndpoints.push(sub.endpoint)
      }

      // Aggiornare contatore rate limiting
      await supabase.from('notification_preferences').update({
        last_notification_sent_at: new Date().toISOString(),
        notifications_sent_today: foods.length,
        notifications_sent_date: new Date().toISOString().split('T')[0],
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
