import { expect, test, type Page } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
  E2E_PASSWORD,
} from './helpers/supabase'

/**
 * Un server irraggiungibile all'avvio non è un'uscita (#216).
 *
 * Prima, ricaricando la pagina col token d'accesso scaduto e il server che non
 * risponde, l'utente finiva sul login: la sessione era ancora in
 * `localStorage`, e la lista in IndexedDB.
 *
 * Qui cade solo Supabase (`route.abort`), non tutta la rete: l'E2E gira sul
 * dev server, che non ha service worker, e con `context.setOffline` la
 * ricarica non troverebbe nemmeno la pagina.
 */

const password = E2E_PASSWORD
const SUPABASE = 'http://127.0.0.1:54321/**'
const TOKEN_RENEWAL = '/auth/v1/token'

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

/** La copia della lista su disco, scritta da React Query con un ritardo. */
async function persistedCacheText(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => resolve('')
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('keyval')) return resolve('')
          const read = db.transaction('keyval').objectStore('keyval').get('entro-react-query-cache')
          read.onerror = () => resolve('')
          read.onsuccess = () => resolve(JSON.stringify(read.result ?? ''))
        }
      }),
  )
}

/** In quale momento scade il token della sessione salvata, in secondi Unix. */
async function storedExpiry(page: Page): Promise<number> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))
    return key ? (JSON.parse(localStorage.getItem(key)!).expires_at as number) : 0
  })
}

test('ricarica col token scaduto e il server irraggiungibile: dashboard con la lista salvata, poi i dati nuovi senza login', async ({ page }) => {
  // Dura più di un minuto, ed è il difetto a volerlo: auth-js ritenta il
  // rinnovo per ~26 s a giro, e prima della correzione il login compariva al
  // terzo giro, 77 s dopo la ricarica (misurato l'8 ott 2026).
  test.setTimeout(180_000)

  const email = createE2EEmail()
  const user = await createE2EUser(email, password)
  try {
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
    await expect.poll(() => persistedCacheText(page)).toContain('Food E2E 0')

    await expireStoredAccessToken(page)
    let unreachable = true
    let renewalAttempts = 0
    await page.route(SUPABASE, (route) => {
      if (!unreachable) return route.continue()
      if (route.request().url().includes(TOKEN_RENEWAL)) renewalAttempts++
      return route.abort('internetdisconnected')
    })
    await page.reload()

    // Dentro subito, con la lista che il browser aveva già.
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()

    // E dentro anche dopo che auth-js ha rinunciato al rinnovo: è lì che
    // consegna al listener la sessione vuota. Otto tentativi a giro: al
    // venticinquesimo i primi tre giri sono finiti.
    await expect.poll(() => renewalAttempts, { timeout: 120_000 }).toBeGreaterThanOrEqual(25)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()

    // Il server torna, e nel frattempo la lista è cambiata. La sessione si
    // rinnova da sola, senza che l'utente faccia niente.
    await seedFoods(listId, user.id, 3)
    unreachable = false
    await expect.poll(() => storedExpiry(page), { timeout: 60_000 }).toBeGreaterThan(Date.now() / 1000)

    // La lista salvata è ancora fresca e non si rilegge da sé: la rilegge la
    // prossima apertura, che non passa dal login.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Visualizza come lista' })).toContainText('(5)')
    await expect(page).not.toHaveURL(/\/login/)
  } finally {
    await deleteE2EUserByEmail(email)
  }
})
