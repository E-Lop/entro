import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { ApplicationServer, importVapidKeys } from '@negrel/webpush'
import type { PushSubscription as WebPushSubscription } from '@negrel/webpush'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { requireCronSecret } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabase.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  /**
   * Autenticazione cron job: pg_cron → Vault → Edge Function
   *
   * Flusso completo:
   * 1. pg_cron esegue il job schedulato ogni giorno alle 9:00 UTC
   * 2. Il job legge il shared secret da Vault:
   *      SELECT decrypted_secret FROM vault.decrypted_secrets
   *      WHERE name = 'cron_secret' LIMIT 1
   * 3. pg_net invia HTTP POST con header:
   *      Authorization: Bearer {cron_secret}
   * 4. Questa Edge Function confronta il token con la env var CRON_SECRET
   *
   * Perché questo pattern: il nuovo formato API key di Supabase (sb_secret_...)
   * non è un JWT decodificabile, quindi non si può usare come Bearer token
   * standard. Si usa invece un shared secret salvato sia in Vault (letto da
   * pg_cron) che come Edge Function secret (letto qui con Deno.env).
   *
   * Riferimenti:
   * - Migration: supabase/migrations/20260228_push_notifications.sql (sezione 4)
   * - Vault setup: SELECT vault.create_secret('<secret>', 'cron_secret', '...')
   */
  const cronAuthError = requireCronSecret(req)
  if (cronAuthError) return cronAuthError

  try {
    const supabase = createServiceClient()

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
      return jsonResponse(req, { success: true, sent: 0 })
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

    return jsonResponse(req, { success: true, sent: totalSent, staleRemoved: staleEndpoints.length })
  } catch (error) {
    console.error('Cron job error:', error)
    return errorResponse(req, 'Internal server error', 500)
  }
})
