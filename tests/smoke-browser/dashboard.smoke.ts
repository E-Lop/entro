/**
 * La suite di smoke nel browser (#191): la PWA servita mostra davvero i dati
 * noti della sentinella A.
 *
 * La suite API (#187) prova il database; questa prova la schermata. Durante la
 * #179 l'API rispondeva 404 e la PWA mostrava una dispensa vuota: un controllo
 * sull'API sarebbe diventato rosso, ma nessuno guardava se il sito mostrava
 * qualcosa.
 *
 * In sola lettura: entra, guarda, e non tocca niente. Si lancia subito dopo
 * `npm run smoke:restore`, perché le etichette attese valgono nel giorno del
 * ripristino (`expectedLabels.ts`). Ogni fallimento è una categoria scritta
 * qui, e il reporter non stampa altro: niente testo delle card nei log.
 */
import { test, type Locator, type Page } from '@playwright/test'
import { FOOD_ACTIONS_ATTR } from '../../src/lib/focusAfterRemoval'
import { check, fail } from '../smoke/failure'
import { KNOWN_FOODS } from '../smoke/knownFoods'
import { expectedLabel } from './expectedLabels'

/** Le scritte con cui la dashboard dice che la lista non c'è (`DashboardPage.tsx`). */
const UNAVAILABLE = 'Non riusciamo a caricare gli alimenti'
const EMPTY = 'Nessun alimento ancora'

/** L'attesa di ogni elemento. Il timeout del test, nella config, deve restare più lungo della loro somma. */
const WAIT_MS = 20_000

function required(name: string): string {
  const value = process.env[name]
  // Il nome della variabile è testo fisso: si può stampare. Il valore no.
  if (!value) fail(`variabile d'ambiente mancante: ${name}`)
  return value
}

/** Aspetta che `locator` compaia; se non compare, fallisce con `category`. */
async function waitOrFail(locator: Locator, category: string): Promise<void> {
  try {
    await locator.waitFor({ state: 'visible', timeout: WAIT_MS })
  } catch {
    // L'errore di Playwright contiene il call log, con l'HTML trovato: non si
    // propaga.
    fail(category)
  }
}

async function signInAsA(page: Page): Promise<void> {
  const email = required('SMOKE_A_EMAIL')
  const password = required('SMOKE_A_PASSWORD')
  try {
    await page.goto('/login')
  } catch {
    fail('sito non raggiungibile')
  }
  await waitOrFail(page.getByLabel('Email'), 'pagina di accesso non mostrata')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await waitOrFail(page.getByRole('heading', { name: /^Ciao, .+!$/ }), 'accesso di A non riuscito')
}

function cardOf(page: Page, id: string): Locator {
  return page.locator(`[${FOOD_ACTIONS_ATTR}="${id}"]`)
}

test('A entra e la dashboard mostra i cinque alimenti noti, ciascuno con la sua etichetta di scadenza', async ({ page }) => {
  await signInAsA(page)

  const anyCard = page.locator(`[${FOOD_ACTIONS_ATTR}]`)
  const unavailable = page.getByText(UNAVAILABLE)
  const empty = page.getByText(EMPTY)

  // Prima la dashboard deve decidere cosa mostrare: una card, l'errore o la
  // dispensa vuota. Le ultime due sono rosse, e lo dicono con il loro nome.
  await waitOrFail(anyCard.or(unavailable).or(empty).first(), 'la dashboard non mostra né la lista né un errore')
  check((await unavailable.count()) === 0, 'alimenti non disponibili: la dashboard mostra l\'errore')
  check((await empty.count()) === 0, 'dispensa vuota al posto dei dati noti')

  for (const food of KNOWN_FOODS) {
    const card = cardOf(page, food.id)
    await waitOrFail(card, `card nota mancante: ${food.id}`)
    const badge = card.locator('[role="status"][aria-label^="Stato scadenza: "]')
    check((await badge.count()) === 1, `etichetta di scadenza mancante: ${food.id}`)
    check(
      (await badge.getAttribute('aria-label')) === `Stato scadenza: ${expectedLabel(food)}`,
      `etichetta inattesa: ${food.id}`
    )
  }

  check((await anyCard.count()) === KNOWN_FOODS.length, 'card estranee nella lista')
})
