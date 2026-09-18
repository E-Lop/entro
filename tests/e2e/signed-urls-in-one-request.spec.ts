import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
  signInAsUser,
} from './helpers/supabase'

/**
 * Le foto della lista si firmano in una richiesta sola (#119).
 *
 * Prima ogni card chiedeva la sua signed URL a ogni montaggio, senza cache:
 * con quattro card, quattro richieste — otto in sviluppo, dove `StrictMode`
 * monta ogni effetto due volte — e altrettante a ogni passaggio Calendario →
 * Lista. Si contano le richieste che il browser fa davvero: il numero di
 * montaggi non lo decide un test unitario.
 *
 * Gli oggetti non esistono nel bucket, e non serve: la richiesta di firma parte
 * lo stesso, e un oggetto che manca è uno stato previsto.
 */

const password = 'E2ePassword!2026'
const CARDS = 4

test.describe('le signed URL della lista', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, CARDS)

    const client = await signInAsUser(email, password)
    for (let i = 0; i < CARDS; i++) {
      const { data, error } = await client
        .from('foods')
        .update({ image_url: `${user.id}/foto-${i}.jpg` })
        .eq('name', `Food E2E ${i}`)
        .select('id')
      // Una UPDATE filtrata dalla RLS torna 200 con lista vuota.
      expect(error ?? data?.length).toBe(1)
    }
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('una richiesta per la lista intera, e nessuna tornando dal calendario', async ({ page }) => {
    const signRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/storage/v1/object/sign/')) signRequests.push(request.url())
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(CARDS)

    // Le richieste partono dopo il montaggio: si aspetta la prima, poi si lascia
    // il tempo a un'eventuale seconda di farsi vedere.
    await expect.poll(() => signRequests.length).toBeGreaterThan(0)
    await page.waitForTimeout(1500)
    expect(signRequests).toHaveLength(1)

    await page.getByRole('button', { name: 'Visualizza come calendario' }).click()
    await page.getByRole('button', { name: 'Visualizza come lista' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(CARDS)
    await page.waitForTimeout(1500)

    expect(signRequests).toHaveLength(1)
  })
})
