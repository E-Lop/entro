import { expect, test } from '@playwright/test'
import { createE2EEmail, createE2EUser, deleteE2EUserByEmail, type E2EUser, E2E_PASSWORD } from './helpers/supabase'

/**
 * Chi ha creato un invito lo revoca, e il codice non fa più entrare (#194).
 *
 * A crea un invito, lo ritrova fra i propri inviti attivi nel dialogo «Crea
 * invito», e lo revoca dopo la conferma. Poi B, senza account, apre il link
 * dell'invito: arriva alla registrazione con lo stesso esito di un codice che
 * non è mai esistito, e nessuno lo invita.
 */

const password = E2E_PASSWORD

/** L'esito di validate-invite per un codice che non trova, come lo dice la registrazione. */
const CODE_NOT_FOUND = 'Non è stato possibile verificare il codice. Riprova.'

test.describe('revoca di un invito', () => {
  let owner: E2EUser

  test.beforeEach(async () => {
    owner = await createE2EUser(createE2EEmail(), password)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(owner.email)
  })

  test('A revoca il suo invito, e B con quel codice non entra', async ({ page, browser }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(owner.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    // A crea un invito.
    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()
    await page.getByRole('button', { name: /Crea invito/ }).click()
    await page.getByRole('button', { name: 'Genera codice invito' }).click()
    const code = (await page.getByRole('status').locator('p.font-mono').textContent())?.trim() ?? ''
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    await page.getByRole('button', { name: 'Chiudi' }).first().click()

    // Lo ritrova fra i propri inviti attivi, e lo revoca.
    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()
    await page.getByRole('button', { name: /Crea invito/ }).click()
    const activeInvites = page.getByRole('list', { name: 'I tuoi inviti attivi' })
    await expect(activeInvites).toContainText(code)

    await page.getByRole('button', { name: `Revoca l'invito ${code}` }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText(code)
    await confirm.getByRole('button', { name: 'Revoca' }).click()

    await expect(page.locator('[data-sonner-toast]').filter({ hasText: `Invito ${code} revocato` })).toBeVisible()
    await expect(activeInvites).toHaveCount(0)

    // B, senza account, apre il link dell'invito.
    const context = await browser.newContext()
    try {
      const other = await context.newPage()
      await other.goto(`/join/${code}`)
      await expect(other).toHaveURL(new RegExp(`/signup\\?code=${code}$`))
      // In sviluppo lo StrictMode di React valida due volte, e i toast sono due
      // e uguali: vale per qualunque codice non valido, non solo per un revocato.
      const alert = other.locator('[data-sonner-toast][data-type="error"]').first()
      await expect(alert).toBeVisible()
      await expect(alert).toContainText(CODE_NOT_FOUND)
      await expect(other.locator('body')).not.toContainText('ti ha invitato')
    } finally {
      await context.close()
    }
  })
})
