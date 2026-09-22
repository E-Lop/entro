import { expect, test, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  deleteList,
  listE2EFoodImages,
  makeUserListShared,
  removeE2EFoodImages,
  signInAsUser,
  uploadE2EFoodImage,
  userExists,
  type E2EUser,
} from './helpers/supabase'

/**
 * #145 — cancellando l'account, le foto degli alimenti che spariscono spariscono
 * anche dal bucket.
 *
 * Prima il dialogo ricavava il percorso con un'espressione che cercava
 * `food-images/`, mentre dal passaggio al bucket privato `image_url` contiene il
 * percorso nudo: non trovava niente, e le foto restavano nello Storage dopo la
 * cancellazione dell'account. Dalla #152 la regola è «si cancellano le foto
 * degli alimenti che la cancellazione elimina davvero»: da unico membro tutte
 * quelle della lista, da una lista condivisa nessuna.
 *
 * Si passa dal dialogo vero, nel browser: è lì che stava il difetto.
 */

const password = 'E2ePassword!2026'
const inFiveDays = () => new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10)

async function addFood(
  client: SupabaseClient,
  user: E2EUser,
  listId: string,
  name: string,
  imageUrl: string,
  removed = false
): Promise<void> {
  const { data: category } = await client.from('categories').select('id').eq('name', 'dairy').single()
  const now = new Date().toISOString()
  const { error } = await client.from('foods').insert({
    list_id: listId,
    user_id: user.id,
    name,
    category_id: category!.id,
    storage_location: 'fridge',
    expiry_date: inFiveDays(),
    image_url: imageUrl,
    ...(removed ? { deleted_at: now, status: 'wasted', consumed_at: now } : {}),
  })
  if (error) throw new Error(`impossibile creare «${name}»: ${error.message}`)
}

async function deleteAccountFromDialog(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Elimina account' }).click()
  await page.getByPlaceholder('Inserisci password').fill(password)
  await page.getByRole('button', { name: 'Capisco, elimina il mio account' }).click()
}

test.describe('cancellazione account e foto (#145)', () => {
  test('da unico membro toglie dal bucket le foto di tutti gli alimenti della lista', async ({ page }) => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    const client = await signInAsUser(email, password)
    try {
      const barePath = await uploadE2EFoodImage(user.id, `${Date.now()}-nudo.jpg`)
      const legacyPath = await uploadE2EFoodImage(user.id, `${Date.now()}-legacy.jpg`)
      const removedPath = await uploadE2EFoodImage(user.id, `${Date.now()}-tolto.jpg`)
      await addFood(client, user, listId, 'con il percorso nudo', barePath)
      // La forma di prima del bucket privato: l'URL firmato intero.
      await addFood(
        client,
        user,
        listId,
        'con l\'URL firmato storico',
        `http://127.0.0.1:54321/storage/v1/object/sign/food-images/${legacyPath}?token=e2e`
      )
      await addFood(client, user, listId, 'tolto, con la foto ancora', removedPath, true)
      expect(await listE2EFoodImages(user.id)).toHaveLength(3)

      await deleteAccountFromDialog(page, email)

      await expect(page).toHaveURL(/\/login/)
      expect(await userExists(user.id)).toBe(false)
      expect(await listE2EFoodImages(user.id)).toEqual([])
    } finally {
      await removeE2EFoodImages(await listE2EFoodImages(user.id))
      await deleteE2EUserByEmail(email)
    }
  })

  test('se lo Storage rifiuta la rimozione, l\'account non viene cancellato e il dialogo lo dice', async ({ page }) => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    const client = await signInAsUser(email, password)
    try {
      const photo = await uploadE2EFoodImage(user.id, `${Date.now()}-foto.jpg`)
      await addFood(client, user, listId, 'con la foto', photo)

      await page.route('**/storage/v1/object/food-images', (route) =>
        route.request().method() === 'DELETE'
          ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"down"}' })
          : route.continue()
      )
      await deleteAccountFromDialog(page, email)

      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByPlaceholder('Inserisci password')).toBeVisible()
      expect(await userExists(user.id)).toBe(true)
      expect(await listE2EFoodImages(user.id)).toEqual([photo])
    } finally {
      await removeE2EFoodImages(await listE2EFoodImages(user.id))
      await deleteE2EUserByEmail(email)
    }
  })

  test('da una lista condivisa non toglie le foto: restano all\'altro membro', async ({ page }) => {
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const photos: string[] = []
    try {
      const memberClient = await signInAsUser(member.email, password)
      const photo = await uploadE2EFoodImage(member.id, `${Date.now()}-foto.jpg`)
      photos.push(photo)
      await addFood(memberClient, member, listId, 'del membro che se ne va', photo)

      await deleteAccountFromDialog(page, member.email)

      await expect(page).toHaveURL(/\/login/)
      expect(await userExists(member.id)).toBe(false)
      const creatorClient = await signInAsUser(creator.email, password)
      const { data, error } = await creatorClient.storage.from('food-images').createSignedUrl(photo, 60)
      expect(error).toBeNull()
      expect(data?.signedUrl).toBeTruthy()
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })
})
