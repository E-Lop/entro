import { expect, test } from '@playwright/test'
import {
  countListMemberships,
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
  getInviteStatusByShortCode,
  seedPendingInviteByCode,
  signInAsUser,
} from './helpers/supabase'

// Chi si registra con un codice invito entra nella lista di chi l'ha invitato
// (#165). Il link /join/:codice porta chi non ha un account a
// /signup?code=…, quindi questo è il percorso di ogni utente nuovo invitato.

const password = 'E2ePassword!2026'

test('registrandosi con un codice invito si entra nella lista di chi ha invitato', async ({ page }) => {
  const ownerEmail = createE2EEmail()
  const owner = await createE2EUser(ownerEmail, password)
  const email = createE2EEmail()
  try {
    const { listId, shortCode } = await seedPendingInviteByCode(owner.id)

    await page.goto(`/signup?code=${shortCode}`)
    await page.locator('input[name="full_name"]').fill('Invitato E2E')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.locator('input[name="confirmPassword"]').fill(password)
    await page.locator('#terms').check()
    await page.getByRole('button', { name: /Registrati|Crea account/ }).click()

    await expect(page.getByRole('heading', { name: /Ciao, /i })).toBeVisible({ timeout: 20000 })

    const client = await signInAsUser(email, password)
    const { data } = await client.auth.getUser()
    const userId = data.user!.id

    await expect
      .poll(() => countListMemberships(listId, userId), { timeout: 15000 })
      .toBe(1)
    expect(await getInviteStatusByShortCode(shortCode)).toBe('accepted')
  } finally {
    await deleteE2EUserByEmail(email)
    await deleteE2EUserByEmail(ownerEmail)
  }
})
