import { expect, test } from '@playwright/test'
import {
  countRemovedFoods,
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
} from './helpers/supabase'

// Offline si tolgono più alimenti, e al ritorno della rete arrivano tutti al
// database senza ricaricare la pagina (#153).
//
// La rete si toglie con `context.setOffline`, che fa scattare gli eventi
// `offline`/`online` del browser: è quello che succede davvero in cantina. Il
// triage del 22 set aveva simulato con `onlineManager.setOnline(false)` e visto
// la coda ripartire solo ricaricando, senza poter dire se fosse un limite della
// simulazione.

const password = 'E2ePassword!2026'

test('offline si tolgono tre alimenti, e tornata la rete arrivano tutti al database', async ({ page, context }) => {
  const email = createE2EEmail()
  const user = await createE2EUser(email, password)
  try {
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 3)

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(3)

    await context.setOffline(true)

    for (let left = 3; left > 0; left--) {
      await page.locator('[aria-label^="Elimina "]').first().click()
      await page.getByRole('button', { name: 'Toglilo e basta' }).click()
      await expect(page.locator('[data-food-actions]')).toHaveCount(left - 1)
    }
    expect(await countRemovedFoods(listId)).toBe(0)

    await context.setOffline(false)

    await expect.poll(() => countRemovedFoods(listId), { timeout: 20000 }).toBe(3)
  } finally {
    await context.setOffline(false)
    await deleteE2EUserByEmail(email)
  }
})
