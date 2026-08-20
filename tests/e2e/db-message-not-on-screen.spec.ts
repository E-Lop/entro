import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
} from './helpers/supabase'

/**
 * Il messaggio del database non arriva a schermo.
 *
 * I test unitari provano che `softDeleteFood` non mette il testo di Postgres in
 * `Error.message`. Non provano che a schermo arrivi *quello*: fra la funzione e
 * l'utente c'è `toast.error(error.message || …)` in `useFoods`, e jsdom prova la
 * regola, non il comportamento.
 *
 * Serve anche per la via di rimbalzo: ora il `PostgrestError` intero vive in
 * `Error.cause`, quindi la domanda giusta non è «il toast dice la cosa giusta?»
 * ma «quel testo compare **da qualche parte** nella pagina?». Per questo
 * l'asserzione finale guarda tutto il body, non solo l'avviso.
 *
 * Il rifiuto è simulato intercettando la richiesta invece di togliere un GRANT:
 * è deterministico e non lascia il database locale in uno stato da ripristinare.
 */

const password = 'E2ePassword!2026'

/** Come lo direbbe la RLS: inglese, col nome della tabella dentro. */
const MESSAGGIO_DB = 'permission denied for table foods'

test.describe('il messaggio del database non arriva a schermo', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('un UPDATE rifiutato mostra un avviso italiano, non il testo di Postgres', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()
    await expect(page.locator('[data-food-actions]')).toHaveCount(2)

    // Da qui in poi ogni scrittura sugli alimenti viene rifiutata.
    await page.route('**/rest/v1/foods*', async (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.continue()
      }
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          message: MESSAGGIO_DB,
          code: '42501',
          details: null,
          hint: null,
        }),
      })
    })

    const nome = await page.evaluate(
      () =>
        document
          .querySelector('[data-food-actions] [aria-label^="Elimina "]')
          ?.getAttribute('aria-label')
          ?.replace(/^Elimina /, '') ?? ''
    )

    await page.getByRole('button', { name: `Elimina ${nome}` }).click()
    await page.getByRole('button', { name: 'Toglilo e basta' }).click()

    // Si aspetta che *un* avviso compaia, e solo dopo si guarda cosa dice.
    // L'ordine non è cosmetico: asserire subito «il testo del database non c'è»
    // passerebbe prima che il toast sia reso, cioè sempre.
    // Ristretto al tipo «errore»: dopo il login resta a schermo anche il toast
    // di conferma, e un selettore generico ne troverebbe due.
    const avviso = page.locator('[data-sonner-toast][data-type="error"]')
    await expect(avviso).toBeVisible()
    await expect(avviso).toContainText(
      'Non è stato possibile togliere l\'alimento dalla lista. Riprova.'
    )

    // La domanda che regge il peso: quel testo non deve comparire da nessuna
    // parte, per nessuna strada — né nell'avviso, né altrove nella pagina.
    await expect(page.locator('body')).not.toContainText(MESSAGGIO_DB)

    // E il rollback ha rimesso la card al suo posto.
    await expect(page.locator('[data-food-actions]')).toHaveCount(2)
  })
})
