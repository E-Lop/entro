import { expect, test, type Page } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
} from './helpers/supabase'

// Dove finisce il fuoco dopo un'eliminazione (entro#87).
//
// Il difetto è nato da una **misura del fuoco su browser**, non da un test in
// jsdom, e va chiuso allo stesso livello: i test di componente provano la
// regola, questo prova che nel browser vero il fuoco non cada su `body`.
// L'ordine fra l'aggiornamento ottimistico della cache, il re-render di React
// e la chiusura del dialogo di Radix è esattamente ciò che jsdom non replica —
// ed è stato questo spec, non i test unitari, a far emergere che anche
// «Annulla» perdeva il fuoco.
//
// La regola verificata è quella della convenzione condivisa
// `entro-family/conventions/fuoco-dopo-una-rimozione.md`: riga successiva,
// intestazione della lista come ripiego.
//
// **Limiti dichiarati.** Gira solo su Chromium, l'unico progetto configurato,
// mentre la misura originale della issue copriva anche WebKit. E sapere dove
// va il fuoco non è sapere cosa viene *pronunciato*: l'annuncio richiede uno
// screen reader reale e resta fuori da qui.

const password = 'E2ePassword!2026'

test.describe('fuoco dopo l’eliminazione', () => {
  let email: string

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    // Seminati dall'admin e non aggiunti dalla UI: il test riguarda il fuoco, e
    // passare dal modulo di inserimento porterebbe dentro la corsa fra il primo
    // salvataggio e la creazione della lista, che la RLS rifiuta.
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  async function login(page: Page) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()
    await expect(page.locator('[data-food-actions]')).toHaveCount(2)
  }

  test('va sulla card successiva, e sull’intestazione quando era l’ultima', async ({ page }) => {
    await login(page)

    // L'ordine di rendering è quello che conta: il fuoco va sulla riga che
    // prende il posto di quella rimossa, qualunque sia l'ordinamento.
    // I nomi si leggono dagli `aria-label`, non dal titolo: l'`h3` include
    // anche la quantità («Food E2E 0(1 pz)»).
    const nomi = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-food-actions]')).map(
        (card) =>
          card
            .querySelector('[aria-label^="Elimina "]')
            ?.getAttribute('aria-label')
            ?.replace(/^Elimina /, '') ?? ''
      )
    )
    const [daEliminare, successivo] = nomi

    await page.getByRole('button', { name: `Elimina ${daEliminare}` }).click()
    await page.getByRole('button', { name: 'Toglilo e basta' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(1)

    const dopoLaPrima = await page.evaluate(() => ({
      suBody: document.activeElement === document.body,
      testo: document.activeElement?.textContent ?? '',
      eUnaCard: document.activeElement?.hasAttribute('data-food-actions') ?? false,
    }))

    expect(dopoLaPrima.suBody, 'il fuoco è caduto su body: è il difetto della #87').toBe(false)
    expect(dopoLaPrima.eUnaCard).toBe(true)
    expect(dopoLaPrima.testo).toContain(successivo)

    // Ora l'ultima rimasta: non c'è un successivo, tocca all'intestazione.
    await page.getByRole('button', { name: `Elimina ${successivo}` }).click()
    await page.getByRole('button', { name: 'Toglilo e basta' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(0)

    const dopoLUltima = await page.evaluate(() => ({
      suBody: document.activeElement === document.body,
      eIntestazione: document.activeElement?.hasAttribute('data-list-heading') ?? false,
    }))

    expect(dopoLUltima.suBody).toBe(false)
    expect(dopoLUltima.eIntestazione).toBe(true)
  })

  test('su «Annulla» il fuoco torna al pulsante che ha aperto il dialogo', async ({ page }) => {
    // Il difetto al contrario, e non è ipotetico: prima di questo rimedio anche
    // «Annulla» lasciava il fuoco su `document.body`, misurato qui.
    await login(page)

    const nome = await page.evaluate(
      () =>
        document
          .querySelector('[data-food-actions] [aria-label^="Elimina "]')
          ?.getAttribute('aria-label')
          ?.replace(/^Elimina /, '') ?? ''
    )

    const apritore = page.getByRole('button', { name: `Elimina ${nome}` })
    await apritore.click()
    await page.getByRole('button', { name: 'Annulla' }).click()

    await expect(apritore).toBeFocused()
  })
})
