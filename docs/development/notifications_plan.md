# Piano: Push Notifications per Entro PWA

> **Istruzioni per Claude Code**: Questo documento contiene tutto il necessario per implementare le push notifications in Entro. Segui gli step nell'ordine indicato. I file con codice completo sono pronti da creare/modificare. Per i dettagli sul codebase esistente, esplora i pattern in `supabase/functions/create-invite/index.ts` (Edge Function pattern), `src/hooks/useRealtimeFoods.ts` (hook pattern), e `src/components/settings/AccountSection.tsx` (settings component pattern).

## Contesto

Entro è una PWA (React 19 + Vite 6 + Supabase) per il tracciamento delle scadenze alimentari. L'app è già installabile su smartphone, ha un service worker per caching/offline (via `vite-plugin-pwa` con Workbox), e realtime via Supabase CDC — ma **non ha push notifications**. L'obiettivo è notificare gli utenti quando i loro alimenti stanno per scadere, sia su Android che iOS.

**Tech stack**: React 19, TypeScript, Vite 6 + SWC, Supabase (PostgreSQL + Realtime + Edge Functions), Zustand 5, React Query 5, React Router DOM 7, Tailwind CSS 3, Radix UI, Sonner (toast), vite-plugin-pwa 1.2.0.

**Vincoli iOS**: Le push notifications funzionano solo se la PWA è installata nella Home Screen (da iOS 16.4+), il permesso deve essere richiesto tramite gesto utente, e non c'è background sync.

**Requisiti utente**:
- Solo notifiche per scadenze cibo (non attività collaboratori)
- Backend: Supabase Edge Functions con Web Push API (VAPID keys)
- Settings completi: toggle per tipo, quiet hours, frequenza max
- Intervalli multipli configurabili (es. 3gg + 1gg + giorno stesso)

---

## Architettura

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Frontend    │────▶│  Supabase Edge Fn     │────▶│  Push Service   │
│  (React PWA) │     │  register-push        │     │  (FCM/APNs via  │
│              │     │  send-expiry-notifs    │     │   Web Push API) │
│  src/sw.ts   │◀────│                        │◀────│                 │
│  (push handler)    │  pg_cron (daily 9AM)  │     └─────────────────┘
└─────────────┘     └──────────────────────┘
```

4 livelli: **Database** (2 nuove tabelle) → **Backend** (2 Edge Functions) → **Service Worker** (push handler) → **Frontend** (UI settings + prompt)

---

## Step 1: Database — Nuove tabelle

Eseguire questa migrazione SQL via Supabase Dashboard (SQL Editor):

```sql
-- ============================================
-- 1. Tabella push_subscriptions
-- ============================================
CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- ============================================
-- 2. Tabella notification_preferences
-- ============================================
CREATE TABLE public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled boolean DEFAULT true NOT NULL,
  expiry_intervals integer[] DEFAULT '{3, 1, 0}' NOT NULL,
  quiet_hours_enabled boolean DEFAULT false NOT NULL,
  quiet_hours_start integer DEFAULT 22 NOT NULL CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23),
  quiet_hours_end integer DEFAULT 8 NOT NULL CHECK (quiet_hours_end >= 0 AND quiet_hours_end <= 23),
  max_notifications_per_day integer DEFAULT 5 NOT NULL CHECK (max_notifications_per_day >= 1 AND max_notifications_per_day <= 20),
  timezone text DEFAULT 'Europe/Rome' NOT NULL,
  last_notification_sent_at timestamptz,
  notifications_sent_today integer DEFAULT 0 NOT NULL,
  notifications_sent_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. Funzione per il cron job
-- ============================================
CREATE OR REPLACE FUNCTION public.get_expiring_foods_for_notifications()
RETURNS TABLE (
  user_id uuid,
  food_id uuid,
  food_name text,
  expiry_date date,
  days_until_expiry integer,
  category_name text,
  timezone text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    lm.user_id,
    f.id AS food_id,
    f.name AS food_name,
    f.expiry_date::date AS expiry_date,
    (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date) AS days_until_expiry,
    c.name_it AS category_name,
    COALESCE(np.timezone, 'Europe/Rome') AS timezone
  FROM foods f
  JOIN list_members lm ON f.list_id = lm.list_id
  JOIN categories c ON f.category_id = c.id
  LEFT JOIN notification_preferences np ON np.user_id = lm.user_id
  WHERE
    f.deleted_at IS NULL
    AND f.status = 'active'
    AND COALESCE(np.enabled, true) = true
    AND (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date)
        = ANY(COALESCE(np.expiry_intervals, '{3, 1, 0}'))
    AND (
      np.notifications_sent_date IS NULL
      OR np.notifications_sent_date != (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date
      OR np.notifications_sent_today < COALESCE(np.max_notifications_per_day, 5)
    )
    AND (
      COALESCE(np.quiet_hours_enabled, false) = false
      OR NOT (
        CASE
          WHEN np.quiet_hours_start < np.quiet_hours_end THEN
            EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              BETWEEN np.quiet_hours_start AND np.quiet_hours_end - 1
          ELSE
            EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              >= np.quiet_hours_start
            OR EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              < np.quiet_hours_end
        END
      )
    )
  ORDER BY lm.user_id, days_until_expiry ASC;
$$;

-- ============================================
-- 4. Abilitare pg_cron e pg_net (se non già attivi)
-- Nota: potrebbe essere necessario farlo dal Dashboard Supabase
-- Database > Extensions > abilitare pg_cron e pg_net
-- ============================================

-- 5. Creare il cron schedule (dopo aver deploiato le Edge Functions)
-- SELECT cron.schedule(
--   'send-expiry-notifications',
--   '0 9 * * *',
--   $$
--     SELECT net.http_post(
--       url := '<SUPABASE_URL>/functions/v1/send-expiry-notifications',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
```

**Note sulla funzione DB**:
- `SECURITY DEFINER` permette alla Edge Function di chiamarla con service_role key
- `LEFT JOIN notification_preferences` significa che utenti senza preferenze ricevono notifiche con defaults
- La logica quiet hours gestisce il wrap-around (es. 22:00-08:00 attraversa mezzanotte)
- Il rate limiting usa `notifications_sent_date` + `notifications_sent_today`

---

## Step 2: VAPID Keys

1. Generare con `npx web-push generate-vapid-keys`
2. **Public key** → `VITE_VAPID_PUBLIC_KEY` in `.env.local` (safe, esposta al client)
3. **Private key** → `supabase secrets set VAPID_PRIVATE_KEY=...` (solo server)
4. **Subject** → `supabase secrets set VAPID_SUBJECT=mailto:support@entroapp.it`

**File da modificare**: `.env.example`, `src/vite-env.d.ts`

---

## Step 3: vite-plugin-pwa — Switch a `injectManifest`

Attualmente usa `generateSW` (Workbox genera tutto il SW). Per aggiungere il push handler, switch a `injectManifest` che permette un SW custom.

**File**: `vite.config.ts` — Sostituire la configurazione VitePWA con:

```typescript
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',     // ERA: implicito 'generateSW'
  srcDir: 'src',                    // NUOVO: directory del SW custom
  filename: 'sw.ts',                // NUOVO: file sorgente del SW
  injectManifest: {                 // SOSTITUISCE: sezione 'workbox'
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  },
  includeAssets: ['icons/favicon-32x32.png', 'icons/apple-touch-icon.png'],
  manifest: {
    // MANTENERE ESATTAMENTE il manifest esistente, non modificarlo
    name: 'entro - Food Expiry Tracker',
    short_name: 'entro',
    description: 'Gestisci le scadenze degli alimenti e riduci gli sprechi',
    theme_color: '#16a34a',
    background_color: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
    scope: '/',
    start_url: '/',
    icons: [
      { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  // NOTA: la sezione 'workbox' con runtimeCaching viene RIMOSSA
  // Il runtime caching è ora dentro src/sw.ts
}),
```

**Importante**: La sezione `workbox: { ... }` con `runtimeCaching` va completamente rimossa — tutto il caching è ora gestito nel SW custom.

---

## Step 4: Service Worker Custom

**Nuovo file**: `src/sw.ts`

```typescript
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute, createHandlerBoundToURL } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

// Workbox precaching — il manifest viene iniettato da vite-plugin-pwa al build
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// --- Runtime caching (migrato da vite.config.ts workbox.runtimeCaching) ---

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/sign\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-images-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
)

// --- Navigate fallback (SPA routing) ---
const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api/],
})
registerRoute(navigationRoute)

// --- Push Notification Handlers ---

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: { url?: string; foodId?: string; type?: string }
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = { title: 'entro', body: event.data.text() }
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/favicon-32x32.png',
    tag: payload.tag || 'entro-expiry',
    data: payload.data || { url: '/' },
    vibrate: [100, 50, 200],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'NOTIFICATION_CLICK', url: urlToOpen })
          return
        }
      }
      return self.clients.openWindow(urlToOpen)
    })
  )
})

self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const pushEvent = event as ExtendableEvent & {
    oldSubscription?: PushSubscription
    newSubscription?: PushSubscription
  }
  pushEvent.waitUntil(
    (async () => {
      if (pushEvent.newSubscription) {
        const clients = await self.clients.matchAll({ type: 'window' })
        for (const client of clients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: pushEvent.newSubscription.toJSON(),
          })
        }
      }
    })()
  )
})
```

**Note**: Il `/// <reference lib="webworker" />` è necessario per i tipi SW. Con `skipLibCheck: true` già presente nel tsconfig, non servono configurazioni aggiuntive.

---

## Step 5: Backend — Edge Functions

### `supabase/functions/register-push/index.ts`

Gestisce subscribe/unsubscribe delle push subscription. Segue il pattern di `create-invite/index.ts`.

```typescript
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
```

### `supabase/functions/send-expiry-notifications/index.ts`

Cron job giornaliero che invia push notifications per alimenti in scadenza.

```typescript
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
```

### Cron: `pg_cron` + `pg_net`
- Schedule: `0 9 * * *` (ogni giorno alle 9:00 UTC = 10:00/11:00 CET/CEST)
- Invoca Edge Function via `net.http_post`
- Richiede abilitazione estensioni `pg_cron` e `pg_net` in Supabase Dashboard
- La query SQL per creare il cron è nello Step 1 (commentata, da eseguire dopo deploy Edge Functions)

### Config: aggiungere a `supabase/config.toml`

```toml
[functions.register-push]
verify_jwt = false

[functions.send-expiry-notifications]
verify_jwt = false
```

---

## Step 6: Frontend — Libreria e Hooks

### `src/lib/pushNotifications.ts`

```typescript
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function getPermissionState(): NotificationPermission {
  if (!isPushSupported()) return 'denied'
  return Notification.permission
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

export async function subscribeToPush(): Promise<{
  success: boolean; subscription?: PushSubscription; error?: string
}> {
  try {
    if (!isPushSupported()) return { success: false, error: 'Push notifications not supported' }

    if (isIOS() && !isPWAInstalled()) {
      return { success: false, error: "Su iOS, aggiungi l'app alla Schermata Home per ricevere notifiche" }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { success: false, error: 'Permesso notifiche negato' }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return { success: false, error: 'Not authenticated' }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/register-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        action: 'subscribe',
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      }),
    })

    if (!response.ok) throw new Error('Failed to register subscription on server')
    return { success: true, subscription }
  } catch (error) {
    console.error('[pushNotifications] Subscribe error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    const subscription = await getCurrentSubscription()
    if (!subscription) return { success: true }

    const { data: sessionData } = await supabase.auth.getSession()
    if (sessionData.session) {
      await fetch(`${SUPABASE_FUNCTIONS_URL}/register-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ action: 'unsubscribe', endpoint: subscription.endpoint }),
      })
    }

    await subscription.unsubscribe()
    return { success: true }
  } catch (error) {
    console.error('[pushNotifications] Unsubscribe error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
```

### `src/hooks/usePushSubscription.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  isPushSupported, isPWAInstalled, isIOS, getPermissionState,
  getCurrentSubscription, subscribeToPush, unsubscribeFromPush,
} from '@/lib/pushNotifications'

export type PushStatus = 'unsupported' | 'ios-not-installed' | 'prompt' | 'subscribed' | 'denied' | 'loading'

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>('loading')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    async function checkStatus() {
      if (!isPushSupported()) { setStatus('unsupported'); return }
      if (isIOS() && !isPWAInstalled()) { setStatus('ios-not-installed'); return }
      const permission = getPermissionState()
      if (permission === 'denied') { setStatus('denied'); return }
      const subscription = await getCurrentSubscription()
      setStatus(subscription ? 'subscribed' : 'prompt')
    }
    checkStatus()
  }, [])

  // Ascoltare cambio subscription dal SW
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        subscribeToPush().then((result) => { if (result.success) setStatus('subscribed') })
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [])

  const subscribe = useCallback(async () => {
    setIsLoading(true)
    const result = await subscribeToPush()
    setIsLoading(false)
    if (result.success) {
      setStatus('subscribed')
      toast.success('Notifiche attivate!')
    } else {
      if (result.error?.includes('Schermata Home')) {
        toast.info(result.error, { duration: 6000 })
        setStatus('ios-not-installed')
      } else if (result.error?.includes('negato')) {
        setStatus('denied')
        toast.error('Permesso negato. Puoi riabilitarlo dalle impostazioni del browser.')
      } else {
        toast.error(result.error || "Errore nell'attivazione delle notifiche")
      }
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    const result = await unsubscribeFromPush()
    setIsLoading(false)
    if (result.success) { setStatus('prompt'); toast.success('Notifiche disattivate') }
    else toast.error('Errore nella disattivazione delle notifiche')
  }, [])

  return { status, isLoading, subscribe, unsubscribe }
}
```

### `src/hooks/useNotificationPreferences.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface NotificationPreferences {
  enabled: boolean
  expiry_intervals: number[]
  quiet_hours_enabled: boolean
  quiet_hours_start: number
  quiet_hours_end: number
  max_notifications_per_day: number
  timezone: string
}

const defaultPreferences: NotificationPreferences = {
  enabled: true,
  expiry_intervals: [3, 1, 0],
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  max_notifications_per_day: 5,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome',
}

export function useNotificationPreferences() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: ['notification_preferences'],
    queryFn: async (): Promise<NotificationPreferences> => {
      if (!user) return defaultPreferences
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) return defaultPreferences
      return {
        enabled: data.enabled,
        expiry_intervals: data.expiry_intervals,
        quiet_hours_enabled: data.quiet_hours_enabled,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        max_notifications_per_day: data.max_notifications_per_day,
        timezone: data.timezone,
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences'] })
    },
  })
}
```

---

## Step 7: Frontend — Componenti UI

### `src/components/settings/NotificationSettings.tsx`

Card nella pagina Impostazioni, posizionata **tra AccountSection e la card Privacy & Dati**. Usa gli stessi componenti UI del progetto (Card, CardHeader, CardTitle, CardDescription, CardContent da `@/components/ui/card`, icona Bell da lucide-react).

Struttura:
- **Header**: Icona Bell + "Notifiche" + descrizione
- **Toggle principale**: Attiva/disattiva push (chiama `subscribe()`/`unsubscribe()` dal hook)
- **Messaggi di stato**: Non supportato, iOS non installata (con istruzioni), permesso negato
- **Intervalli scadenza**: Checkbox per ciascuno: 7, 3, 2, 1, 0 giorni (labels in italiano: "7 giorni prima", "3 giorni prima", "2 giorni prima", "1 giorno prima", "Giorno della scadenza")
- **Quiet hours**: Toggle + due selettori orario (0-23)
- **Max giornaliero**: Dropdown (1-10)
- Ogni modifica salva automaticamente via `useUpdateNotificationPreferences()`

### `src/components/pwa/NotificationPrompt.tsx`

Banner dismissibile nella Dashboard. Struttura:
- **Condizioni di visualizzazione**: push supportato AND permission === 'default' AND non dismissato (`localStorage.getItem('entro_notification_prompt_dismissed')`) AND foodCount >= 3
- **UI**: Icona Bell + "Vuoi ricevere notifiche quando i tuoi alimenti stanno per scadere?"
- **Bottone "Attiva"** (primary) → chiama `subscribeToPush()` — questo è il gesto utente necessario per iOS
- **Bottone "Non ora"** (ghost) → salva in `localStorage` e nasconde
- **Props**: `foodCount: number`

---

## Step 8: Integrazioni nei file esistenti

### `src/vite-env.d.ts` — Aggiungere tipo per VAPID key
```typescript
interface ImportMetaEnv {
  // ... variabili esistenti ...
  readonly VITE_VAPID_PUBLIC_KEY: string
}
```

### `src/lib/supabase.ts` — Aggiungere tipi per nuove tabelle
Aggiungere i tipi `push_subscriptions` e `notification_preferences` all'interfaccia Database esistente. Seguire il pattern delle tabelle esistenti (`foods`, `lists`, ecc.).

### `src/lib/auth.ts` — Unsubscribe on signOut
Nella funzione `signOut()`, aggiungere `await unsubscribeFromPush().catch(() => {})` prima del `supabase.auth.signOut()` (non bloccante).

### `src/pages/SettingsPage.tsx` — Aggiungere NotificationSettings
Importare e inserire `<NotificationSettings />` tra `<AccountSection />` e la card `Privacy & Dati`:
```tsx
<AccountSection />
<NotificationSettings />  {/* NUOVO */}
{/* Privacy & Data Section - card esistente */}
<Card> ...
```

### `src/pages/DashboardPage.tsx` — Aggiungere NotificationPrompt
Inserire `<NotificationPrompt foodCount={stats.total} />` nella dashboard, sotto le stats card. Verificare che `stats.total` o equivalente sia disponibile nel componente.

### `src/App.tsx` — Listener per notification click
Aggiungere un `useEffect` per ascoltare messaggi dal SW:
```typescript
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
      window.location.href = event.data.url
    }
  }
  navigator.serviceWorker?.addEventListener('message', handler)
  return () => navigator.serviceWorker?.removeEventListener('message', handler)
}, [])
```

### `.env.example` — Aggiungere VAPID key
```
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-here
```

### `package.json` — Version bump a 1.3.0

---

## Nuovi file

| File | Scopo |
|------|-------|
| `src/sw.ts` | Service worker custom con push handler |
| `src/lib/pushNotifications.ts` | Servizio push subscription |
| `src/hooks/usePushSubscription.ts` | Hook stato push |
| `src/hooks/useNotificationPreferences.ts` | Hook preferenze notifiche |
| `src/components/settings/NotificationSettings.tsx` | UI impostazioni notifiche |
| `src/components/pwa/NotificationPrompt.tsx` | Banner opt-in dashboard |
| `supabase/functions/register-push/index.ts` | Edge Function registrazione |
| `supabase/functions/send-expiry-notifications/index.ts` | Edge Function cron invio |

---

## Edge cases gestiti

- **Device disinstallato**: Cron job riceve 410 Gone → cleanup automatico subscription
- **Multi-device**: Ogni device ha subscription separata, notifica inviata a tutti
- **Timezone**: Auto-detect da browser, quiet hours valutati nel fuso dell'utente
- **Rate limiting**: Contatore giornaliero per utente, reset a cambio data
- **Subscription rigenerata**: SW listener `pushsubscriptionchange` → re-registra
- **Permesso revocato**: Hook rileva `denied`, subscription diventa stale → cleanup dal cron
- **Logout**: `signOut()` chiama `unsubscribeFromPush()` per cleanup

---

## Verifica e test

1. **Build locale**: `npm run build && npm run preview` (SW funziona solo con HTTPS/localhost)
2. **Test push simulata**: DevTools > Application > Service Workers > Push per simulare evento push
3. **Test subscription**: Verificare che la subscription appaia in `push_subscriptions` su Supabase
4. **Test cron**: Invocare manualmente `send-expiry-notifications` via `curl` o Supabase Dashboard
5. **Test iOS**: Installare PWA su iPhone, verificare prompt permesso, ricevere notifica
6. **Test Android**: Installare PWA su Android, verificare notifica su lock screen
7. **Test settings**: Modificare intervalli/quiet hours, verificare che il cron rispetti le preferenze
8. **Test cleanup**: Disinstallare PWA, verificare che subscription venga rimossa al prossimo cron

---

## Ordine di deployment

1. Generare VAPID keys + impostare secrets Supabase
2. Eseguire migrazione SQL (tabelle + funzione + pg_cron)
3. Deploy Edge Functions
4. Applicare modifiche frontend (vite config → SW → lib → hooks → componenti → integrazioni)
5. Build e test locale
6. Deploy frontend
7. Verificare cron job in produzione
