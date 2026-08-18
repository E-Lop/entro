import { expect, test } from '@playwright/test'
import { countFoodsByUserEmail, createE2EEmail, deleteE2EUserByEmail } from './helpers/supabase'

// La lista personale nasce con l'utente, nel database (#94).
//
// Il test blocca `create_personal_list` a livello di rete: è la RPC che finora
// creava la lista lato client, dopo l'accesso. Se il salvataggio riesce lo
// stesso, la lista può venire da una sola parte — il trigger
// `on_auth_user_created` — e la corsa fra quella RPC e la UI non esiste più.
//
// Prima della migrazione questo scenario si riproduceva in modo deterministico
// e mostrava all'utente `new row violates row-level security policy for table
// "foods"`: il messaggio di Postgres, in inglese, col nome della tabella.

const password = 'E2ePassword!2026'

function futureDateInputValue(daysFromToday: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return date.toISOString().slice(0, 10)
}

test.describe('lista personale alla registrazione', () => {
  let email: string

  test.beforeEach(() => {
    email = createE2EEmail()
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('il primo alimento si salva anche se la RPC del client fallisce', async ({ page }) => {
    await page.route('**/rest/v1/rpc/create_personal_list*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"message":"indisponibile"}',
      })
    )

    await page.goto('/signup')
    await page.locator('input[name="full_name"]').fill('Utente E2E')
    await page.locator('input[name="email"]').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.locator('input[name="confirmPassword"]').fill(password)
    await page.locator('#terms').check()
    await page.getByRole('button', { name: /Registrati|Crea account/ }).click()

    await expect(page.getByRole('heading', { name: /Ciao, /i })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Alimento', exact: true }).click()
    const dialogo = page.getByRole('dialog', { name: 'Aggiungi Nuovo Alimento' })
    await dialogo.getByLabel('Nome *').fill('Primo alimento')
    await dialogo.getByLabel('Categoria *').selectOption({ label: 'Latticini' })
    await dialogo.getByLabel('Posizione *').selectOption({ label: 'Frigo' })
    await dialogo.getByLabel('Data di scadenza *').fill(futureDateInputValue(5))
    await dialogo.getByRole('button', { name: 'Aggiungi alimento' }).click()

    await expect(dialogo).toBeHidden()

    await expect(page.getByRole('heading', { name: /Primo alimento/ })).toBeVisible()

    // Vedere la card **non prova** che la scrittura sia riuscita: è
    // ottimistica, e nemmeno un ricaricamento basta — entro persiste la cache
    // di React Query, quindi la card tornerebbe dal `localStorage`. La prova è
    // interrogare il database.
    await expect
      .poll(() => countFoodsByUserEmail(email), { timeout: 15000 })
      .toBe(1)

    // Il testo di Postgres non deve comparire da nessuna parte, nemmeno in un
    // avviso che sparisce: era il sintomo che l'utente vedeva.
    await expect(page.getByText(/row-level security/)).toHaveCount(0)
  })
})
