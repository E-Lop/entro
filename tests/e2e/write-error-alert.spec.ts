import { expect, test } from '@playwright/test'
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
 * Un errore di scrittura arriva allo screen reader come alert (#121).
 *
 * MDN, *ARIA: alert role*, nomina alla lettera il nostro caso: «The connection
 * to the server was lost so local changes will not be saved». sonner mette
 * tutti i toast in una sola live region `polite`: l'errore veniva accodato
 * invece di interrompere. E MDN avverte che un elemento con `role="alert"`
 * creato già pieno spesso non viene annunciato: il nodo deve esistere prima,
 * e cambiare contenuto.
 *
 * Il test legge l'albero di accessibilità di Chromium (`getByRole`), non il
 * markup.
 */

const password = E2E_PASSWORD
const SAVE_FAILED = "Non è stato possibile salvare l'alimento. Riprova."

test.describe('errori di scrittura e screen reader', () => {
  let user: E2EUser

  test.beforeEach(async () => {
    user = await createE2EUser(createE2EEmail(), password)
    await seedFoods(await createListForUser(user.id), user.id, 1)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(user.email)
  })

  test('una modifica rifiutata finisce in un alert che esisteva già, vuoto', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()

    // Prima dell'errore: la regione c'è già, ed è vuota.
    const announcer = page.locator('[data-write-error-announcer]')
    await expect(announcer).toHaveCount(1)
    await expect(announcer).toHaveAttribute('role', 'alert')
    await expect(announcer).toHaveText('')

    await page.route('**/rest/v1/foods?id=*', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"x","code":"XX000"}' })
        : route.continue(),
    )
    await page.getByRole('button', { name: 'Modifica Food E2E 0' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Modifica Alimento' })
    await editDialog.getByLabel(/Quantit/).fill('3')
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click()

    // L'errore è nell'alert, e il toast visivo resta.
    await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILED })).toHaveCount(1)
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(SAVE_FAILED)
  })

  test('un successo resta nella live region polite di sonner, non in un alert', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    const welcome = page.locator('[data-sonner-toast]').filter({ hasText: 'Accesso effettuato' })
    await expect(welcome).toBeVisible()
    await expect(page.locator('section[aria-live="polite"]').filter({ has: welcome })).toHaveCount(1)
    await expect(page.getByRole('alert').filter({ hasText: 'Accesso effettuato' })).toHaveCount(0)
  })
})
