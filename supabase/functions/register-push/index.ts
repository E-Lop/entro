import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabase.ts'

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
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createServiceClient()

    // Autenticare l'utente
    const auth = await requireAuthenticatedUser(req, supabase)
    if (auth instanceof Response) return auth
    const user = auth.user

    const body: SubscribeRequest = await req.json()

    if (body.action === 'subscribe') {
      if (!body.subscription) {
        return errorResponse(req, 'Subscription data required', 400)
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

      return jsonResponse(req, { success: true })
    }

    if (body.action === 'unsubscribe') {
      const endpoint = body.endpoint || body.subscription?.endpoint
      if (!endpoint) {
        return errorResponse(req, 'Endpoint required', 400)
      }

      await supabase.from('push_subscriptions').delete()
        .eq('user_id', user.id).eq('endpoint', endpoint)

      return jsonResponse(req, { success: true })
    }

    return errorResponse(req, 'Invalid action', 400)
  } catch (error) {
    console.error('Error:', error)
    return errorResponse(req, 'Internal server error', 500)
  }
})
