import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
  makeUserListShared,
  type E2EUser,
} from './helpers/supabase'

const password = 'E2ePassword!2026'

// Regressione #59 — "Broken mobile layout": su viewport mobile il dialog
// "Inviti" sforava a destra perché le descrizioni dentro i <Button>
// ereditavano `whitespace-nowrap` e non andavano a capo, spingendo il
// contenuto oltre il bordo del viewport (testo troncato).
test.use({ viewport: { width: 390, height: 844 } })

test.describe('layout menu inviti (mobile)', () => {
  let user: E2EUser
  let coMember: E2EUser | undefined

  test.beforeEach(async () => {
    user = await createE2EUser(createE2EEmail(), password)
    // Serve una lista condivisa per far comparire il bottone con la
    // descrizione più lunga (quello troncato nello screenshot dell'issue).
    coMember = await makeUserListShared(user.id, password)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(user.email)
    if (coMember) await deleteE2EUserByEmail(coMember.email)
  })

  test('il dialog "Inviti" non sfora il viewport orizzontalmente', async ({ page }, testInfo) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()

    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()

    const dialog = page.getByRole('dialog', { name: 'Inviti' })
    await expect(dialog).toBeVisible()
    // Il bottone con la descrizione più lunga deve essere presente e per intero.
    await expect(
      dialog.getByText('Esci dalla lista condivisa e crea una nuova lista personale'),
    ).toBeVisible()

    await testInfo.attach('invite-menu-390px', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    // Nessun elemento del dialog deve estendersi oltre il bordo destro del viewport.
    const viewportWidth = page.viewportSize()!.width
    const overflowing = await dialog.evaluate((root, vw) => {
      const offenders: { text: string; right: number }[] = []
      root.querySelectorAll('*').forEach((el) => {
        const right = el.getBoundingClientRect().right
        if (right > vw + 0.5) {
          offenders.push({
            text: (el.textContent ?? '').trim().slice(0, 40),
            right: Math.round(right),
          })
        }
      })
      return offenders
    }, viewportWidth)

    expect(
      overflowing,
      `Elementi del dialog che sforano il viewport (${viewportWidth}px): ${JSON.stringify(overflowing)}`,
    ).toEqual([])
  })
})
