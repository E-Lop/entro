import { expect, test } from '@playwright/test'
import { createE2EEmail, createE2EUser, deleteE2EUserByEmail } from './helpers/supabase'

const password = 'E2ePassword!2026'

function futureDateInputValue(daysFromToday: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

test.describe('gestione alimenti', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    await createE2EUser(email, password)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('login, aggiunta alimento, modifica quantita e logout', async ({ page }) => {
    const foodName = `Yogurt E2E ${Date.now()}`

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()

    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    await page.getByRole('button', { name: 'Alimento' }).click()
    const addDialog = page.getByRole('dialog', { name: 'Aggiungi Nuovo Alimento' })
    await expect(addDialog).toBeVisible()

    await addDialog.getByLabel('Nome *').fill(foodName)
    await addDialog.getByLabel('Categoria *').selectOption({ label: 'Latticini' })
    await addDialog.getByLabel('Posizione *').selectOption({ label: 'Frigo' })
    await addDialog.getByLabel('Data di scadenza *').fill(futureDateInputValue(5))
    await addDialog.getByLabel(/Quantit/).fill('2')
    await addDialog.getByLabel(/Unit/).selectOption('pz')
    await addDialog.getByRole('button', { name: 'Aggiungi alimento' }).click()

    await expect(addDialog).toBeHidden()
    await expect(page.getByRole('heading', { name: new RegExp(foodName) })).toBeVisible()
    await expect(page.getByText('(2 pz)')).toBeVisible()

    await page.getByRole('button', { name: `Modifica ${foodName}` }).click()
    const editDialog = page.getByRole('dialog', { name: 'Modifica Alimento' })
    await expect(editDialog).toBeVisible()

    await editDialog.getByLabel(/Quantit/).fill('3')
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click()

    await expect(editDialog).toBeHidden()
    await expect(page.getByText('(3 pz)')).toBeVisible()

    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Disconnetti' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Accedi a entro' })).toBeVisible()
  })
})
