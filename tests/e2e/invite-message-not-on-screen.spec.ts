import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
  makeUserListShared,
  type E2EUser,
} from './helpers/supabase'

/**
 * Il messaggio del server non arriva a schermo dagli inviti.
 *
 * Gemello di `db-message-not-on-screen.spec.ts`, per l'altro file condiviso.
 * Vale la stessa ragione: i test unitari provano che `error.message` è
 * italiano, non che a schermo arrivi *quello* — fra i due c'è
 * `toast.error(result.error.message || …)` in `LeaveListDialog`, e vitest gira
 * in jsdom.
 *
 * Due percorsi, perché il difetto aveva **due forme diverse** e provarne una
 * sola avrebbe lasciato credere di aver provato l'altra:
 *
 * - **«abbandona lista condivisa»** — qui il vecchio codice faceva
 *   `throw removeError`, cioè rilanciava il `PostgrestError` così com'era. Ma
 *   quell'oggetto **non è** un'istanza di `Error`, quindi il ramo
 *   `error instanceof Error ? error : new Error('Unknown error')` cadeva sul
 *   ripiego e a schermo arrivava `Unknown error`: difetto di **lingua**, non
 *   di fuga. Misurato, non dedotto.
 * - **«genera codice invito»** — qui il vecchio codice faceva
 *   `throw new Error(data.error || …)` con `data.error` preso dal corpo della
 *   Edge Function, e quel testo arrivava intatto nel toast: la **fuga** vera.
 */

const password = 'E2ePassword!2026'

/** Come lo direbbe Postgres su una DELETE rifiutata. */
const MESSAGGIO_DB = 'permission denied for table list_members'

/** Come lo direbbe una Edge Function nel corpo della risposta. */
const MESSAGGIO_FUNZIONE = 'JWT expired at 1755000000'

test.describe('il messaggio del server non arriva a schermo dagli inviti', () => {
  let user: E2EUser
  let coMember: E2EUser | undefined

  test.beforeEach(async () => {
    user = await createE2EUser(createE2EEmail(), password)
    // «Abbandona lista condivisa» compare solo se la lista è davvero condivisa.
    coMember = await makeUserListShared(user.id, password)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(user.email)
    if (coMember) await deleteE2EUserByEmail(coMember.email)
  })

  test('una DELETE rifiutata mostra un avviso italiano, non il testo di Postgres', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    // Solo la rimozione dalla lista viene rifiutata: le letture che la
    // precedono devono riuscire, altrimenti si proverebbe un altro ramo.
    await page.route('**/rest/v1/list_members*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        return route.continue()
      }
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          message: MESSAGGIO_DB,
          code: '42501',
          details: null,
          hint: null,
        }),
      })
    })

    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()
    await page.getByRole('button', { name: /Abbandona lista condivisa/ }).click()
    await page.getByRole('button', { name: 'Abbandona lista' }).click()

    const avviso = page.locator('[data-sonner-toast][data-type="error"]')
    await expect(avviso).toBeVisible()
    await expect(avviso).toContainText(
      'Non è stato possibile abbandonare la lista. Riprova.'
    )

    // La domanda che regge il peso: quel testo non deve comparire da nessuna
    // parte, per nessuna strada.
    await expect(page.locator('body')).not.toContainText(MESSAGGIO_DB)
  })

  test('la risposta di una Edge Function non finisce nel toast', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    await page.route('**/functions/v1/create-invite', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: MESSAGGIO_FUNZIONE }),
      })
    })

    await page.getByRole('button', { name: 'Menu utente' }).click()
    await page.getByRole('menuitem', { name: 'Inviti' }).click()
    await page.getByRole('button', { name: /Crea invito/ }).click()
    await page.getByRole('button', { name: 'Genera codice invito' }).click()

    const avviso = page.locator('[data-sonner-toast][data-type="error"]')
    await expect(avviso).toBeVisible()
    await expect(avviso).toContainText('Non è stato possibile creare l\'invito. Riprova.')

    await expect(page.locator('body')).not.toContainText(MESSAGGIO_FUNZIONE)
  })
})
