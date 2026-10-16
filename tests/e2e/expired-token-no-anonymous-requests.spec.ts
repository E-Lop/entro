import { expect, test, type Page, type Request } from '@playwright/test'
import {
  countRemovedFoods,
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
  E2E_PASSWORD,
} from './helpers/supabase'

/**
 * Chi è dentro non manda richieste da anonimo quando il rinnovo del token non
 * riesce (#229, gemella di entro-mobile#259).
 *
 * A scheda nascosta auth-js ferma il rinnovo automatico
 * (`_onVisibilityChanged`), quindi il token scade. Se poi il rinnovo non
 * arriva al server, auth-js risponde che la sessione non c'è
 * (`__loadSession`), e supabase-js mette nell'`Authorization` la chiave
 * pubblica. Riprodotto il 16 ott 2026 in due momenti:
 *
 * - tornando alla scheda, la dashboard rilegge la lista (`useRealtimeFoods`):
 *   la lettura partiva da anonimo, e il server rispondeva 401;
 * - una scrittura fatta a scheda nascosta (la coda offline che riparte in
 *   background) leggeva la sessione, la trovava assente per l'errore di rete,
 *   e si annullava con «Utente non autenticato»: nessuna richiesta partiva, e
 *   la riga tolta tornava a schermo.
 *
 * A scheda sempre visibile non succede: il rinnovo automatico tiene il lock
 * della sessione, e le richieste aspettano senza partire.
 *
 * Una richiesta è «da anonimo» quando il suo `Authorization` porta la stessa
 * chiave dell'`apikey`: è ciò che fa supabase-js senza un token di sessione.
 */

const password = E2E_PASSWORD
const TOKEN_RENEWAL = '**/auth/v1/token*'
const DATA = /\/rest\/v1\/foods/
const FOODS_READ = /\/rest\/v1\/foods\?select=/

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.locator('[data-food-actions]')).toHaveCount(2)
}

/** Porta indietro di un'ora la scadenza del token nella sessione salvata. */
async function expireStoredAccessToken(page: Page) {
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))
    if (!key) throw new Error('Nessuna sessione in localStorage')
    const session = JSON.parse(localStorage.getItem(key)!)
    session.expires_at = Math.floor(Date.now() / 1000) - 3600
    localStorage.setItem(key, JSON.stringify(session))
  })
}

/** La scheda va in background o torna in primo piano, come la vede la pagina. */
async function setTabHidden(page: Page, hidden: boolean) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (isHidden ? 'hidden' : 'visible'),
    })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => isHidden })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

/** In background il token scade, e il rinnovo non arriva più al server. */
async function expireInBackground(page: Page) {
  await setTabHidden(page, true)
  await page.route(TOKEN_RENEWAL, (route) => route.abort('internetdisconnected'))
  await expireStoredAccessToken(page)
}

function isAnonymous(request: Request): boolean {
  const headers = request.headers()
  return headers.authorization === `Bearer ${headers.apikey}`
}

/** Le richieste ai dati che partono da anonimo, raccolte da qui in avanti. */
function collectAnonymousData(page: Page): string[] {
  const anonymous: string[] = []
  page.on('request', (request) => {
    if (DATA.test(request.url()) && isAnonymous(request)) {
      anonymous.push(`${request.method()} ${request.url()}`)
    }
  })
  return anonymous
}

test.describe('token scaduto e rinnovo che non arriva al server', () => {
  // auth-js ritenta il rinnovo per ~26 s a giro (#216), e il rinnovo
  // automatico, quando torna, gira ogni 30 s.
  test.setTimeout(240_000)

  test('tornando alla scheda nessuna lettura parte da anonimo, e tornata la rete la lista si rilegge col token', async ({ page }) => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    try {
      const listId = await createListForUser(user.id)
      await seedFoods(listId, user.id, 2)
      await signIn(page, email)

      const anonymous = collectAnonymousData(page)
      let renewals = 0
      page.on('request', (request) => {
        if (request.url().includes('/auth/v1/token')) renewals++
      })

      await expireInBackground(page)
      await setTabHidden(page, false)

      // Senza la regola la rilettura partiva da anonimo entro questo tempo
      // (misurato il 16 ott 2026). Un aggancio a un messaggio della console si
      // è dimostrato fragile: dipende dai tempi del canale realtime.
      await page.waitForTimeout(90_000)
      // Il caso è avvenuto davvero: almeno un giro intero di rinnovo fallito.
      expect(renewals).toBeGreaterThanOrEqual(8)
      expect(anonymous).toEqual([])
      await expect(page.locator('[data-food-actions]')).toHaveCount(2)

      // Torna la rete: il rinnovo riesce, e la lista si rilegge col token.
      const readWithToken = page.waitForResponse(
        (response) =>
          FOODS_READ.test(response.url()) && !isAnonymous(response.request()) && response.status() === 200,
        { timeout: 90_000 },
      )
      await page.unroute(TOKEN_RENEWAL)
      await readWithToken
      expect(anonymous).toEqual([])
    } finally {
      await deleteE2EUserByEmail(email)
    }
  })

  test('una scrittura a scheda nascosta resta in coda, e arriva al server una volta sola quando il rinnovo riesce', async ({ page }) => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    try {
      const listId = await createListForUser(user.id)
      await seedFoods(listId, user.id, 2)
      await signIn(page, email)

      const anonymous = collectAnonymousData(page)
      const removals: string[] = []
      page.on('request', (request) => {
        if (DATA.test(request.url()) && request.method() === 'PATCH') removals.push(request.url())
      })

      await expireInBackground(page)
      await page.locator('[aria-label^="Elimina "]').first().click()
      await page.getByRole('button', { name: 'Toglilo e basta' }).click()
      await expect(page.locator('[data-food-actions]')).toHaveCount(1)

      // Un giro di rinnovo fallito, e un po' di margine: la scrittura è in
      // pausa, non annullata. Senza la regola si annullava poco dopo.
      await page.waitForTimeout(45_000)
      expect(anonymous).toEqual([])
      expect(await countRemovedFoods(listId)).toBe(0)
      await expect(page.getByText("Non è stato possibile")).toHaveCount(0)
      await expect(page.locator('[data-food-actions]')).toHaveCount(1)

      // Torna la rete e la scheda: il rinnovo riesce, la coda riparte da sola,
      // senza ricaricare.
      await page.unroute(TOKEN_RENEWAL)
      await setTabHidden(page, false)
      await expect.poll(() => countRemovedFoods(listId), { timeout: 90_000 }).toBe(1)

      expect(removals).toHaveLength(1)
      expect(anonymous).toEqual([])
    } finally {
      await deleteE2EUserByEmail(email)
    }
  })
})
