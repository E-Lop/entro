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
 * A rete presente il form aspetta l'esito della scrittura (#248 per la
 * creazione, #255 per la modifica).
 *
 * Il caso è la rete «bugiarda»: `navigator.onLine` è vero, ma la richiesta non
 * arriva. Prima il dialogo si chiudeva alla conferma, e quando la scrittura
 * falliva i dati e la foto scelta se ne andavano con lui. Ora resta aperto con
 * tutto dentro, e un secondo «Salva» con la rete tornata riesce.
 *
 * La rete che cade è simulata con `route.abort('failed')` sulla sola
 * scrittura: `fetch` rifiuta come quando la connessione salta, il resto della
 * pagina continua a parlare con lo stack locale.
 */

const password = E2E_PASSWORD
const NEW_FOOD = 'Ricotta di prova'
const SAVE_FAILED = 'Non è stato possibile salvare l\'alimento. Riprova.'

/**
 * Un'immagine vera e abbastanza grande da avere un'anteprima visibile: un PNG
 * 1×1 la rende alta zero, e Playwright la considera nascosta.
 */
const PHOTO = 'public/icons/icon-192x192.png'

const inFiveDays = () => new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)
const errorToast = (page: Page) => page.locator('[data-sonner-toast][data-type="error"]')

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.locator('[data-food-actions]')).toHaveCount(1)
}

test.describe('una scrittura che fallisce per rete lascia il form aperto', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 1)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('creazione (#248): dati e foto restano, e il secondo «Salva» crea l’alimento con la foto', async ({
    page,
  }) => {
    await signIn(page, email)

    await page.route('**/rest/v1/foods*', (route) =>
      route.request().method() === 'POST' ? route.abort('failed') : route.continue(),
    )

    await page.getByRole('button', { name: 'Alimento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Aggiungi Nuovo Alimento' })
    await dialog.getByLabel('Nome *').fill(NEW_FOOD)
    await dialog.getByLabel('Categoria *').selectOption({ label: 'Latticini' })
    await dialog.getByLabel('Posizione *').selectOption({ label: 'Frigo' })
    await dialog.getByLabel('Data di scadenza *').fill(inFiveDays())
    await dialog.getByLabel('Input galleria immagini').setInputFiles(PHOTO)
    // L'anteprima è `loading="lazy"` in un dialogo che scorre: fuori vista non
    // ha dimensioni, e Playwright la direbbe nascosta. Che il file scelto sia
    // nel form lo dice il `src`, che è il file letto in locale.
    const preview = dialog.getByAltText('Anteprima immagine alimento')
    await expect(preview).toHaveAttribute('src', /^data:image\//)
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)

    await dialog.getByRole('button', { name: 'Aggiungi alimento' }).click()

    // Prima l'errore, poi il dialogo: asserire subito che è aperto passerebbe
    // anche prima che la scrittura sia partita.
    await expect(errorToast(page)).toContainText('Non è stato possibile salvare')
    await expect(dialog).toBeVisible()
    // Con il dialogo modale aperto il resto della pagina è `aria-hidden`,
    // compreso l'alert di `AppLayout` (#121): l'errore lo annuncia quello del
    // dialogo.
    await expect(dialog.getByRole('alert')).toHaveText(SAVE_FAILED)
    await expect(dialog.getByLabel('Nome *')).toHaveValue(NEW_FOOD)
    await expect(preview).toHaveAttribute('src', /^data:image\//)
    await expect(page.getByRole('heading', { name: new RegExp(NEW_FOOD) })).toHaveCount(0)

    // La rete torna.
    await page.unroute('**/rest/v1/foods*')
    await dialog.getByRole('button', { name: 'Aggiungi alimento' }).click()

    await expect(dialog).toBeHidden({ timeout: 15_000 })
    await expect(page.locator('[data-food-actions]')).toHaveCount(2)
    await expect(page.getByAltText(NEW_FOOD)).toBeVisible()
  })

  test('modifica (#255): le modifiche restano, e il secondo «Salva» le scrive', async ({ page }) => {
    await signIn(page, email)

    await page.route('**/rest/v1/foods?id=*', (route) =>
      route.request().method() === 'PATCH' ? route.abort('failed') : route.continue(),
    )

    await page.getByRole('button', { name: 'Modifica Food E2E 0' }).click()
    const dialog = page.getByRole('dialog', { name: 'Modifica Alimento' })
    await dialog.getByLabel(/Quantit/).fill('3')
    await dialog.getByRole('button', { name: 'Salva modifiche' }).click()

    await expect(errorToast(page)).toContainText('Non è stato possibile salvare')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('alert')).toHaveText(SAVE_FAILED)
    await expect(dialog.getByLabel(/Quantit/)).toHaveValue('3')

    await page.unroute('**/rest/v1/foods?id=*')
    await dialog.getByRole('button', { name: 'Salva modifiche' }).click()

    await expect(dialog).toBeHidden({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Modifica Food E2E 0' }).click()
    await expect(dialog.getByLabel(/Quantit/)).toHaveValue('3')
  })
})
