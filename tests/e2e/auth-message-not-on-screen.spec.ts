import { expect, test } from '@playwright/test'
import { createE2EEmail, createE2EUser, deleteE2EUserByEmail } from './helpers/supabase'

/**
 * Il messaggio di Supabase Auth non arriva a schermo (entro#100).
 *
 * I test unitari provano che `signIn` non mette il testo del server in
 * `Error.message`. Non provano che a schermo arrivi *quello*: fra la funzione e
 * l'utente c'è `setServerError(result.error?.message)` in `AuthForm`, e ora
 * l'originale vive in `Error.cause`. Per questo l'asserzione finale guarda
 * tutto il body, non solo l'avviso.
 *
 * Il primo caso non intercetta niente: la password sbagliata la rifiuta la
 * Supabase locale, col suo `error_code` vero. Il secondo simula l'auth
 * irraggiungibile, il caso in cui `auth-js` mette nel messaggio la risposta
 * serializzata.
 */

const password = 'E2ePassword!2026'

test.describe('il messaggio di Supabase Auth non arriva a schermo', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    await createE2EUser(email, password)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('la password sbagliata dà un avviso italiano, e generico', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill('PasswordSbagliata!1')
    await page.getByRole('button', { name: 'Accedi' }).click()

    // Prima si aspetta che *un* avviso compaia, poi si guarda cosa dice:
    // asserire subito l'assenza passerebbe prima che l'avviso sia reso.
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Email o password non corretti')

    await expect(page.locator('body')).not.toContainText(/invalid login credentials/i)
  })

  test('con l’auth irraggiungibile non compaiono né JSON né URL', async ({ page }) => {
    await page.route('**/auth/v1/token*', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'text/plain',
        body: 'service unavailable',
      }),
    )

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 30_000 })
    await expect(alert).toContainText('Qualcosa è andato storto, riprova')

    await expect(page.locator('body')).not.toContainText(/auth\/v1|"status"|service unavailable/i)
  })

  // `abort` fa fallire `fetch`, che è come `auth-js` vede la rete assente:
  // `AuthRetryableFetchError` a `status` 0.
  test('senza rete l’avviso dice di controllare la connessione', async ({ page }) => {
    await page.route('**/auth/v1/token*', (route) => route.abort('failed'))

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 30_000 })
    await expect(alert).toContainText(
      'Non riesco a raggiungere il server. Controlla la connessione e riprova',
    )

    await expect(page.locator('body')).not.toContainText(/failed to fetch|auth\/v1/i)
  })
})
