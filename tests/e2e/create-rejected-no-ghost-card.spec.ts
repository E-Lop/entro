import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
} from './helpers/supabase'

/**
 * Una creazione rifiutata non lascia in lista una card che non esiste (#139).
 *
 * Il caso è quello in cui falliscono **tutte e due**: la scrittura e la
 * rilettura della lista che la segue. È anche il più probabile, perché una
 * creazione fallisce soprattutto quando il server non si raggiunge. Prima la
 * card ottimistica restava a schermo a tempo indeterminato, contata nei totali,
 * con il toast d'errore già sparito.
 *
 * Il rifiuto è simulato intercettando le richieste: è deterministico e non
 * lascia il database locale in uno stato da ripristinare.
 */

const password = 'E2ePassword!2026'
const GHOST = 'Card Fantasma'

const inFiveDays = () => new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)

test.describe('una creazione rifiutata', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    // Un alimento vero in lista, così i totali restano a schermo e il conteggio
    // giusto è 1 e non «nessuna lista».
    await seedFoods(listId, user.id, 1)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('non lascia la sua card in lista, nemmeno se fallisce anche la rilettura', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(1)

    // Da qui in poi il server non risponde più sugli alimenti: né scrive né rilegge.
    await page.route('**/rest/v1/foods*', (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        return route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'permission denied for table foods', code: '42501' }),
        })
      }
      if (method === 'GET') return route.fulfill({ status: 503, body: 'down' })
      return route.continue()
    })

    await page.getByRole('button', { name: 'Alimento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Aggiungi Nuovo Alimento' })
    await dialog.getByLabel('Nome *').fill(GHOST)
    await dialog.getByLabel('Categoria *').selectOption({ label: 'Latticini' })
    await dialog.getByLabel('Posizione *').selectOption({ label: 'Frigo' })
    await dialog.getByLabel('Data di scadenza *').fill(inFiveDays())
    await dialog.getByRole('button', { name: 'Aggiungi alimento' }).click()

    // Prima l'errore, poi l'assenza: asserire subito che la card non c'è
    // passerebbe prima ancora che l'aggiornamento ottimistico l'abbia messa.
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByRole('heading', { name: new RegExp(GHOST) })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Mostra tutti gli alimenti (1)' })).toBeVisible()
    await expect(page.locator('[data-food-actions]')).toHaveCount(1)
  })
})
