import { expect, test, type Page, type Route } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
  type E2EUser,
  E2E_PASSWORD,
} from './helpers/supabase'

/**
 * Una lettura degli alimenti fallita non è una dispensa vuota (#181).
 *
 * Dal 25 al 27 set 2026 `foods` rispondeva 404 a tutti, e per ~41 ore la
 * dashboard ha mostrato «Nessun alimento ancora»: nessuno ha visto un errore
 * (#179). La dashboard distingue ora quattro stati: caricamento, alimenti non
 * disponibili (errore senza dati), aggiornamento fallito (errore con i dati
 * già in mano), dispensa davvero vuota.
 */

const password = E2E_PASSWORD

/** Come lo direbbe Postgres: non deve comparire a schermo. */
const SERVER_MESSAGE = 'permission denied for table foods'
const SERVER_CODE = '42501'

const UNAVAILABLE = 'Non riusciamo a caricare gli alimenti'
const EMPTY = 'Nessun alimento ancora'

/** Solo la lettura della lista degli alimenti: le scritture passano. */
const FOODS_READ = '**/rest/v1/foods?select=*&deleted_at=is.null*'

/** La lettura delle categorie: un'altra query, con la sua freschezza di un'ora. */
const CATEGORIES_READ = '**/rest/v1/categories?select=*'

function failWith500(route: Route) {
  return route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ message: SERVER_MESSAGE, code: SERVER_CODE, details: null, hint: null }),
  })
}

async function signIn(page: Page, user: E2EUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()
}

async function expectNoServerText(page: Page) {
  await expect(page.locator('body')).not.toContainText(SERVER_MESSAGE)
  await expect(page.locator('body')).not.toContainText(SERVER_CODE)
}

test.describe('la dashboard quando la lettura degli alimenti fallisce', () => {
  let user: E2EUser

  test.beforeEach(async () => {
    user = await createE2EUser(createE2EEmail(), password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(user.email)
  })

  test('senza dati: errore con «Riprova tra poco.», e «Riprova» mostra la lista', async ({ page }) => {
    let failing = true
    await page.route(FOODS_READ, (route) => (failing ? failWith500(route) : route.continue()))

    await signIn(page, user)

    const status = page.getByRole('status').filter({ hasText: UNAVAILABLE })
    await expect(status).toBeVisible()
    await expect(status).toContainText('Riprova tra poco.')
    await expect(page.getByText(EMPTY)).toHaveCount(0)
    await expectNoServerText(page)

    failing = false
    await status.getByRole('button', { name: 'Riprova' }).click()
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
    await expect(status).toHaveCount(0)
  })

  test('se cadono anche le categorie, «Riprova» rilancia anche loro (#210)', async ({ page }) => {
    // `refetchOnWindowFocus` è spento per tutta l'app: senza il rilancio di
    // «Riprova» le categorie restavano in errore finché la pagina non veniva
    // ricaricata. Un contesto nuovo non ha la cache di una sessione prima.
    let failing = true
    let categoryReads = 0
    await page.route(FOODS_READ, (route) => (failing ? failWith500(route) : route.continue()))
    await page.route(CATEGORIES_READ, (route) => {
      categoryReads++
      return failing ? failWith500(route) : route.continue()
    })

    await signIn(page, user)

    const status = page.getByRole('status').filter({ hasText: UNAVAILABLE })
    await expect(status).toBeVisible()
    // Il tentativo e il suo unico ritentativo (`retry: 1`), entrambi falliti.
    await expect.poll(() => categoryReads).toBeGreaterThanOrEqual(2)
    const readsBeforeRetry = categoryReads

    failing = false
    const categoriesBack = page.waitForResponse(
      (response) => response.url().includes('/rest/v1/categories') && response.status() === 200,
    )
    await status.getByRole('button', { name: 'Riprova' }).click()

    await categoriesBack
    expect(categoryReads).toBeGreaterThan(readsBeforeRetry)
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
    await expectNoServerText(page)
  })

  test('con la lista già caricata: un aggiornamento fallito lascia le card e mostra un avviso', async ({ page }) => {
    await signIn(page, user)
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()

    // Da qui ogni rilettura fallisce; la modifica passa, e dopo la modifica
    // la lista si rilegge.
    await page.route(FOODS_READ, failWith500)
    await page.getByRole('button', { name: 'Modifica Food E2E 0' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Modifica Alimento' })
    await editDialog.getByLabel(/Quantit/).fill('3')
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click()

    const warning = page.getByRole('status').filter({ hasText: 'Non riusciamo ad aggiornare gli alimenti' })
    await expect(warning).toBeVisible()
    await expect(warning).toContainText('Riprova tra poco.')
    await expect(warning.getByRole('button', { name: 'Riprova' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Food E2E 1/ })).toBeVisible()
    await expectNoServerText(page)
  })

  test('offline e senza dati: «Controlla la connessione e riprova.», e al ritorno della rete si aggiorna da sé', async ({ page, context }) => {
    // La prima lettura resta appesa finché non si va offline, poi cade come
    // cade una richiesta senza rete. Tornati online, le letture passano.
    let pending: Route | undefined
    let offline = false
    await page.route(FOODS_READ, (route) => {
      if (!pending) {
        pending = route
        return
      }
      return offline ? route.abort('internetdisconnected') : route.continue()
    })

    await signIn(page, user)
    await expect.poll(() => pending !== undefined).toBe(true)
    offline = true
    await context.setOffline(true)
    await pending!.abort('internetdisconnected')

    const status = page.getByRole('status').filter({ hasText: UNAVAILABLE })
    await expect(status).toBeVisible()
    await expect(status).toContainText('Controlla la connessione e riprova.')
    await expect(page.getByText(EMPTY)).toHaveCount(0)

    // Nessun «Riprova»: la lettura era in pausa, e riparte con la rete. Lista
    // e conteggi vengono dagli stessi dati, quindi tornano insieme.
    offline = false
    await context.setOffline(false)
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Visualizza come lista' })).toContainText('(2)')
    await expect(status).toHaveCount(0)
  })

  test('una dispensa davvero vuota dice ancora «Nessun alimento ancora»', async ({ page }) => {
    const empty = await createE2EUser(createE2EEmail(), password)
    try {
      // Senza la scheda d'istruzioni, che per un utente nuovo viene prima.
      await page.addInitScript(() => localStorage.setItem('entro_hasSeenInstructionCard', 'true'))
      await signIn(page, empty)
      await expect(page.getByText(EMPTY)).toBeVisible()
      await expect(page.getByText(UNAVAILABLE)).toHaveCount(0)
    } finally {
      await deleteE2EUserByEmail(empty.email)
    }
  })
})
