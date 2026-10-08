import { expect, test, type Page } from '@playwright/test'
import {
  createE2EUser,
  createE2EEmail,
  createListForUser,
  deleteE2EUserByEmail,
  isMember,
  makeUserListShared,
  seedFoods,
  type E2EUser,
  E2E_PASSWORD,
} from './helpers/supabase'

/**
 * Chi ha creato una lista condivisa toglie un membro (#196).
 *
 * A è il creatore, B è entrato dopo e ha un alimento nella lista. Si guardano
 * i due lati: A, che vede l'elenco e conferma; e B, che lo scopre tornando in
 * primo piano se ha l'app aperta, o alla riapertura se era chiusa. In tutti e
 * due i casi una volta sola.
 */

const password = E2E_PASSWORD

const REMOVED_NOTICE = 'Non fai più parte della lista condivisa. I tuoi alimenti sono rimasti lì.'
const EMPTY = 'Nessun alimento ancora'

async function signIn(page: Page, user: E2EUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()
}

/** A apre «Inviti», toglie l'unico altro membro e conferma. */
async function removeTheOtherMember(page: Page) {
  await page.getByRole('button', { name: 'Menu utente' }).click()
  await page.getByRole('menuitem', { name: 'Inviti' }).click()
  await expect(page.getByRole('heading', { name: 'Membri della lista' })).toBeVisible()
  await page.getByRole('button', { name: 'Togli Utente E2E dalla lista' }).click()

  const confirm = page.getByRole('dialog', { name: 'Togli dalla lista' })
  await expect(confirm).toContainText('Vuoi togliere Utente E2E dalla lista condivisa?')
  await expect(confirm).toContainText('Gli alimenti che ha inserito restano nella lista.')
  await expect(confirm).toContainText('Riparte da una lista personale vuota')
  await expect(confirm).toContainText('Gli inviti ancora attivi di questa lista smettono di funzionare.')
  await confirm.getByRole('button', { name: 'Togli dalla lista' }).click()

  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Utente E2E non fa più parte della lista' }),
  ).toBeVisible()
}

test.describe('togliere un membro da una lista condivisa', () => {
  let creator: E2EUser
  let member: E2EUser
  let listId: string

  test.beforeEach(async () => {
    creator = await createE2EUser(createE2EEmail(), password)
    member = await makeUserListShared(creator.id, password)
    listId = await createListForUser(creator.id)
    await seedFoods(listId, member.id, 1)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(member.email)
    await deleteE2EUserByEmail(creator.email)
  })

  test('con B collegato: tornando in primo piano B trova l’avviso e una lista vuota, e l’avviso non si ripete', async ({ page, browser }) => {
    const context = await browser.newContext()
    try {
      const other = await context.newPage()
      await other.addInitScript(() => localStorage.setItem('entro_hasSeenInstructionCard', 'true'))
      await signIn(other, member)
      await expect(other.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()

      await signIn(page, creator)
      await removeTheOtherMember(page)

      // B torna sulla scheda: la pagina riparte da sola, sulla sua lista personale.
      await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      const notice = other.locator('[data-sonner-toast]').filter({ hasText: REMOVED_NOTICE })
      await expect(notice).toHaveCount(1, { timeout: 15_000 })
      await expect(other.getByText(EMPTY)).toBeVisible()
      await expect(other.getByRole('heading', { name: /Food E2E 0/ })).toHaveCount(0)

      // Una volta sola: né tornando di nuovo in primo piano, né ricaricando.
      await other.reload()
      await expect(other.getByText(EMPTY)).toBeVisible()
      await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await other.waitForTimeout(1500)
      await expect(notice).toHaveCount(0)

      // Ad A resta l'alimento che B aveva inserito, e l'elenco dei membri sparisce.
      expect(await isMember(listId, member.id)).toBe(false)
      await page.reload()
      await expect(page.getByRole('heading', { name: /Food E2E 0/ })).toBeVisible()
      await page.getByRole('button', { name: 'Menu utente' }).click()
      await page.getByRole('menuitem', { name: 'Inviti' }).click()
      await expect(page.getByText('Crea invito')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Membri della lista' })).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('con B a app chiusa: alla riapertura B trova l’avviso, una volta sola', async ({ page, browser }) => {
    await signIn(page, creator)
    await removeTheOtherMember(page)

    const context = await browser.newContext()
    try {
      const other = await context.newPage()
      await other.addInitScript(() => localStorage.setItem('entro_hasSeenInstructionCard', 'true'))
      await signIn(other, member)

      const notice = other.locator('[data-sonner-toast]').filter({ hasText: REMOVED_NOTICE })
      // Uno solo, anche in sviluppo dove React monta due volte: l'avviso si
      // consuma in un'istruzione sola.
      await expect(notice).toHaveCount(1)
      await expect(other.getByText(EMPTY)).toBeVisible()

      await other.reload()
      await expect(other.getByText(EMPTY)).toBeVisible()
      await other.waitForTimeout(1500)
      await expect(notice).toHaveCount(0)
    } finally {
      await context.close()
    }
  })

  test('un membro qualunque non vede l’elenco dei membri', async ({ page }) => {
    await signIn(page, member)

    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()

    await expect(page.getByText('Abbandona lista condivisa')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Membri della lista' })).toHaveCount(0)
  })
})
