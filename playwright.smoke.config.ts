import { defineConfig, devices } from '@playwright/test'
import { LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from './tests/e2e/helpers/localSupabase'
import { SMOKE_TIME_ZONE } from './tests/smoke/calendarDay'

/**
 * La suite di smoke nel browser (#191), separata dagli E2E.
 *
 * - Con `SMOKE_SITE_URL` guarda quel sito, per esempio https://entroapp.it.
 * - Senza, avvia un dev server suo sul Supabase **locale**, su una porta che
 *   gli E2E non usano, e non ne riusa mai uno già acceso: il `.env.local` di
 *   questo repo punta alla produzione, e un `npm run dev` lanciato a mano
 *   parlerebbe con quella.
 *
 * Le credenziali di A vengono dall'ambiente (`SMOKE_A_EMAIL`,
 * `SMOKE_A_PASSWORD`), come nella suite API. Niente tracce, video né scatti,
 * da nessuna corsa: contro la produzione conterrebbero i dati delle card, e i
 * log di questo repo sono pubblici.
 */
const LOCAL_PORT = 5174
const targetUrl = process.env.SMOKE_SITE_URL

export default defineConfig({
  testDir: './tests/smoke-browser',
  testMatch: '**/*.smoke.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Più delle attese dello spec messe insieme (nove da 20 s, navigazione compresa): se scadesse
  // prima il test, il suo errore prenderebbe il posto della categoria. È
  // successo con Kong spento, quando il timeout era quello di default, 30 s.
  timeout: 240_000,
  reporter: './tests/smoke-browser/reporter.ts',
  use: {
    baseURL: targetUrl ?? `http://127.0.0.1:${LOCAL_PORT}`,
    timezoneId: SMOKE_TIME_ZONE,
    locale: 'it-IT',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  ...(targetUrl
    ? {}
    : {
        webServer: {
          command: `npm run dev -- --host 127.0.0.1 --port ${LOCAL_PORT} --strictPort`,
          url: `http://127.0.0.1:${LOCAL_PORT}`,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            VITE_SUPABASE_URL: LOCAL_SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
          },
        },
      }),
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
