import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  removeE2EFoodImages,
  seedFoods,
  signInAsUser,
  uploadE2EFoodImage,
} from './helpers/supabase'

/**
 * L'esportazione dati porta le foto come signed URL (#119).
 *
 * `getSignedImageUrls` è diventata una `createSignedUrls` sola, e l'esportazione
 * è l'altro suo chiamante: deve dare ciò che dava prima. Una foto che esiste
 * esce come URL firmato; una riga che punta a un oggetto cancellato tiene il
 * suo percorso, e non ferma l'esportazione né la foto accanto.
 */

const password = 'E2ePassword!2026'

test.describe('l’esportazione dei dati', () => {
  let email: string
  let uploaded: string[] = []

  test.beforeEach(async () => {
    email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    await seedFoods(listId, user.id, 2)

    uploaded = [await uploadE2EFoodImage(user.id, 'presente.jpg')]
    const client = await signInAsUser(email, password)
    const writes = await Promise.all([
      client.from('foods').update({ image_url: uploaded[0] }).eq('name', 'Food E2E 0').select('id'),
      client
        .from('foods')
        .update({ image_url: `${user.id}/cancellata.jpg` })
        .eq('name', 'Food E2E 1')
        .select('id'),
    ])
    for (const { data, error } of writes) expect(error ?? data?.length).toBe(1)
  })

  test.afterEach(async () => {
    await removeE2EFoodImages(uploaded)
    await deleteE2EUserByEmail(email)
  })

  test('firma la foto che c’è, e lascia il percorso di quella che manca', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page.getByRole('heading', { name: /Ciao, Utente E2E!/ })).toBeVisible()

    await page.goto('/settings')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Esporta i miei dati' }).click()
    const exported = JSON.parse(await readFile(await (await download).path(), 'utf8')) as {
      foods: { name: string; image_url: string | null }[]
    }

    const imageOf = (name: string) => exported.foods.find((food) => food.name === name)?.image_url

    expect(imageOf('Food E2E 0')).toMatch(/\/object\/sign\/food-images\/.+presente\.jpg\?token=/)
    expect(imageOf('Food E2E 1')).toMatch(/cancellata\.jpg$/)
  })

  // #147: dalla v1.11.0 togliere un alimento conserva la riga con il suo esito,
  // e l'esportazione promette «una copia di tutti i tuoi dati».
  test('porta anche gli alimenti tolti, con il loro esito', async ({ page }) => {
    const client = await signInAsUser(email, password)
    const now = new Date().toISOString()
    const { error } = await client
      .from('foods')
      .update({ deleted_at: now, status: 'wasted', consumed_at: now })
      .eq('name', 'Food E2E 1')
    expect(error).toBeNull()

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.locator('input[name="password"]').fill(password)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page).not.toHaveURL(/\/login/)

    await page.goto('/settings')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Esporta i miei dati' }).click()
    const exported = JSON.parse(await readFile(await (await download).path(), 'utf8')) as {
      foods: { name: string; status: string; deleted_at: string | null; consumed_at: string | null }[]
    }

    const removed = exported.foods.find((food) => food.name === 'Food E2E 1')
    expect(removed).toMatchObject({ status: 'wasted' })
    expect(removed?.deleted_at).toBeTruthy()
    expect(removed?.consumed_at).toBeTruthy()
    expect(exported.foods.find((food) => food.name === 'Food E2E 0')).toMatchObject({
      status: 'active',
      deleted_at: null,
    })
  })
})
