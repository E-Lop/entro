import { expect, test, type Page } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  removeE2EFoodImages,
  seedFoods,
  signInAsUser,
  uploadE2EFoodImage,
  E2E_PASSWORD,
} from './helpers/supabase'

/**
 * Una foto con la firma scaduta non resta rotta (#211).
 *
 * Una signed URL vale un'ora, e il browser chiede le foto più in basso solo
 * quando ci si scorre sopra (`loading="lazy"`). Con la lista aperta da più di
 * un'ora partivano con un token scaduto, Storage rifiutava, e restava l'icona
 * dell'immagine rotta.
 *
 * Qui l'ora dura pochi secondi: la richiesta di firma passa dal test, che ne
 * accorcia la scadenza. L'app continua a credere che valga un'ora.
 */

const password = E2E_PASSWORD
const CARDS = 14
const SIGN = '**/storage/v1/object/sign/**'
const SHORT_LIFE_SECONDS = 3

/** Quante foto della lista sono a schermo e decodificate. */
function loadedPhotos(page: Page): Promise<number> {
  return page
    .locator('img[alt^="Food E2E"]')
    .evaluateAll((images) => images.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length)
}

test.describe('le foto con la firma scaduta', () => {
  // Una colonna sola: la lista è molto più lunga dello schermo, e le foto in
  // fondo stanno oltre la distanza a cui il browser le carica in anticipo.
  test.use({ viewport: { width: 390, height: 700 } })

  let email: string
  let photos: string[]

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, CARDS)

    const client = await signInAsUser(email, password)
    photos = []
    for (let i = 0; i < CARDS; i++) {
      const path = await uploadE2EFoodImage(user.id, `foto-${i}.jpg`)
      photos.push(path)
      const { data, error } = await client
        .from('foods')
        .update({ image_url: path })
        .eq('name', `Food E2E ${i}`)
        .select('id')
      // Una UPDATE filtrata dalla RLS torna 200 con lista vuota.
      expect(error ?? data?.length).toBe(1)
    }
  })

  test.afterEach(async () => {
    await removeE2EFoodImages(photos)
    await deleteE2EUserByEmail(email)
  })

  test('scorrendo dopo la scadenza, le foto in fondo si vedono lo stesso', async ({ page }) => {
    let signRequests = 0
    await page.route(SIGN, (route) => {
      // Sotto lo stesso percorso passano anche le foto, in GET.
      if (route.request().method() !== 'POST') return route.continue()
      signRequests++
      const body = route.request().postDataJSON()
      return route.continue({ postData: JSON.stringify({ ...body, expiresIn: SHORT_LIFE_SECONDS }) })
    })

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(CARDS)
    await expect.poll(() => loadedPhotos(page)).toBeGreaterThan(0)

    // Le firme scadono con la lista ferma in cima. Le foto in fondo il
    // browser non le ha ancora chieste: se le avesse, la prova non proverebbe.
    await page.waitForTimeout((SHORT_LIFE_SECONDS + 2) * 1000)
    expect(await loadedPhotos(page)).toBeLessThan(CARDS)
    expect(signRequests).toBe(1)

    await page.locator('[data-food-actions]').last().scrollIntoViewIfNeeded()

    await expect.poll(() => loadedPhotos(page), { timeout: 15_000 }).toBe(CARDS)
    await expect(page.locator('img[alt^="Food E2E"]')).toHaveCount(CARDS)
  })

  test('con la lista aperta le firme si rinnovano prima dell’ora, tutte in una richiesta', async ({ page }) => {
    const signedPaths: number[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/storage/v1/object/sign/')) {
        signedPaths.push(request.postDataJSON().paths.length)
      }
    })
    // L'orologio della pagina è del test: l'ora passa in un istante.
    await page.clock.install()

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.locator('[data-food-actions]')).toHaveCount(CARDS)
    await expect.poll(() => signedPaths).toEqual([CARDS])
    await expect.poll(() => loadedPhotos(page)).toBeGreaterThan(0)
    const before = await loadedPhotos(page)

    await page.clock.fastForward('56:00')

    await expect.poll(() => signedPaths).toEqual([CARDS, CARDS])
    // Le foto già a schermo restano: nessuna torna indietro.
    await expect.poll(() => loadedPhotos(page)).toBeGreaterThanOrEqual(before)
    await expect(page.locator('img[alt^="Food E2E"]')).toHaveCount(CARDS)
  })
})
