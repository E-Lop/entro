import { expect, test, type Page } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  signInAsUser,
} from './helpers/supabase'

/**
 * #144 — una data di scadenza passata si salva, nel browser vero.
 *
 * La v1.12.0 (#122, da #118) ha reso valida una data passata nello schema, ma
 * il campo aveva ancora il vincolo nativo `min` = oggi: il browser rifiutava
 * l'invio prima che partisse `handleSubmit`, e un alimento già scaduto non si
 * poteva più modificare in nessun campo. jsdom non applica la validazione
 * nativa dei vincoli, quindi solo il browser lo può provare.
 */

const password = 'E2ePassword!2026'
const daysFromToday = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)

async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

test.describe('data di scadenza passata (#144)', () => {
  let email: string
  let userId: string
  let listId: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    userId = user.id
    listId = await createListForUser(user.id)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('un alimento nuovo con la data di ieri si salva', async ({ page }) => {
    await signIn(page, email)

    await page.getByRole('button', { name: 'Alimento' }).click()
    const dialog = page.getByRole('dialog', { name: 'Aggiungi Nuovo Alimento' })
    await dialog.getByLabel('Nome *').fill('Yogurt di ieri')
    await dialog.getByLabel('Categoria *').selectOption({ label: 'Latticini' })
    await dialog.getByLabel('Posizione *').selectOption({ label: 'Frigo' })
    await dialog.getByLabel('Data di scadenza *').fill(daysFromToday(-1))
    await dialog.getByRole('button', { name: 'Aggiungi alimento' }).click()

    await expect(dialog).toBeHidden()
    const client = await signInAsUser(email, password)
    await expect
      .poll(async () => (await client.from('foods').select('name, expiry_date')).data)
      .toEqual([{ name: 'Yogurt di ieri', expiry_date: daysFromToday(-1) }])
  })

  test('un alimento già scaduto si modifica senza toccare la data', async ({ page }) => {
    const client = await signInAsUser(email, password)
    const { data: category } = await client.from('categories').select('id').eq('name', 'dairy').single()
    const { error } = await client.from('foods').insert({
      list_id: listId,
      user_id: userId,
      name: 'Latte scaduto',
      category_id: category!.id,
      storage_location: 'fridge',
      expiry_date: daysFromToday(-3),
    })
    expect(error).toBeNull()

    await signIn(page, email)
    await page.getByRole('button', { name: 'Modifica Latte scaduto' }).click()
    const editDialog = page.getByRole('dialog', { name: 'Modifica Alimento' })
    await editDialog.getByLabel('Nome *').fill('Latte scaduto, rinominato')
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click()

    await expect(editDialog).toBeHidden()
    await expect
      .poll(async () => (await client.from('foods').select('name, expiry_date')).data)
      .toEqual([{ name: 'Latte scaduto, rinominato', expiry_date: daysFromToday(-3) }])
  })
})
