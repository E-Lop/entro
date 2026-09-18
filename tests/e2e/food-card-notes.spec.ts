import { expect, test, type Locator } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  seedFoods,
  signInAsUser,
} from './helpers/supabase'

/**
 * Le note sulla card: due righe intere, e l'a capo dov'è stato scritto (entro#133).
 *
 * Tutti e due i difetti sono **resa**, non DOM: `line-clamp` ritaglia al bordo
 * del padding, quindi la terza riga spuntava dentro il padding di sotto, e un
 * `\n` senza `white-space` diventa uno spazio. jsdom non ha layout e non li
 * vede: qui si contano le righe che il browser disegna davvero.
 */

const password = 'E2ePassword!2026'

/** Come le scrive `openfoodfacts.ts` dopo una scansione: due voci, un a capo. */
const SCANNED = 'Marca: Coop\nCategorie OFF: Snacks, Snacks dolci, Cacao e derivati, Cioccolato'

const LONG =
  'Aperto lunedì, da finire entro la settimana. Tenere nel ripiano alto del frigo, ' +
  'lontano dalla verdura, e ricordarsi di richiudere bene la confezione ogni volta ' +
  'perché prende subito l’odore degli altri alimenti che stanno lì vicino.'

/**
 * Le righe di testo che cadono, anche solo in parte, dentro l'area che il
 * riquadro lascia vedere, e la riga su cui sta ciascuna delle due voci.
 */
async function renderedLines(notes: Locator) {
  return notes.evaluate((box) => {
    // L'area visibile la decide **chi ritaglia**, non il riquadro: si risale dal
    // testo fino al riquadro e si interseca con ogni antenato che ha `overflow`.
    const clipFor = (node: Node) => {
      let top = -Infinity
      let bottom = Infinity
      for (let el = node.parentElement; el; el = el === box ? null : el.parentElement) {
        if (getComputedStyle(el).overflowY === 'visible') continue
        const rect = el.getBoundingClientRect()
        top = Math.max(top, rect.top)
        bottom = Math.min(bottom, rect.bottom)
      }
      return { top, bottom }
    }
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
    const tops = new Set<number>()
    const topOf: Record<string, number> = {}
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      const clip = clipFor(node)
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.top < clip.bottom - 1 && rect.bottom > clip.top + 1) {
          tops.add(Math.round(rect.top))
        }
      }
      for (const word of ['Marca', 'Categorie']) {
        const at = text.indexOf(word)
        if (at < 0) continue
        range.setStart(node, at)
        range.setEnd(node, at + word.length)
        topOf[word] = Math.round(range.getBoundingClientRect().top)
      }
    }
    return { visible: tops.size, topOf }
  })
}

test.describe('le note sulla card', () => {
  let email: string

  test.beforeEach(async ({ page }) => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)

    const client = await signInAsUser(email, password)
    const writes = await Promise.all([
      client.from('foods').update({ notes: SCANNED }).eq('name', 'Food E2E 0').select('id'),
      client.from('foods').update({ notes: LONG }).eq('name', 'Food E2E 1').select('id'),
    ])
    // Una UPDATE filtrata dalla RLS torna 200 con lista vuota: senza questo il
    // test cercherebbe note che non ci sono.
    for (const { data, error } of writes) expect(error ?? data?.length).toBe(1)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-notes]')).toHaveCount(2)
  })

  test.afterEach(async () => {
    await deleteE2EUserByEmail(email)
  })

  test('una nota lunga mostra due righe, e della terza non si vede niente', async ({ page }) => {
    const notes = page.locator('[data-food-notes]', { hasText: 'Aperto lunedì' })

    expect((await renderedLines(notes)).visible).toBe(2)
  })

  test('l’a capo fra «Marca» e «Categorie OFF» resta un a capo', async ({ page }) => {
    const notes = page.locator('[data-food-notes]', { hasText: 'Marca: Coop' })

    const { visible, topOf } = await renderedLines(notes)

    expect(topOf.Categorie).toBeGreaterThan(topOf.Marca)
    expect(visible).toBe(2)
  })
})
