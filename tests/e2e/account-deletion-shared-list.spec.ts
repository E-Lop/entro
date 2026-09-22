import { expect, test } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  deleteList,
  listExists,
  makeUserListShared,
  removeE2EFoodImages,
  signInAsUser,
  uploadE2EFoodImage,
  type E2EUser,
} from './helpers/supabase'

/**
 * #152 — cancellare l'account di un membro non deve togliere niente agli altri.
 *
 * In una lista condivisa non c'è un «mio» e un «tuo»: gli alimenti sono della
 * lista. Prima di questa correzione, cancellare l'account di chi aveva creato
 * la lista portava via la lista intera (FK `lists.created_by` in cascata) e con
 * lei alimenti e iscrizioni degli altri; cancellare quello di un membro
 * qualsiasi portava via gli alimenti che aveva creato (`foods.user_id` in
 * cascata, più il `delete` esplicito di `delete_user()`).
 *
 * Le scritture passano dai client degli utenti, con la RLS attiva: una
 * verifica con la chiave di servizio direbbe che le righe esistono, non che
 * l'altro membro le vede.
 */

const password = 'E2ePassword!2026'

async function categoryId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from('categories').select('id').eq('name', 'dairy').single()
  if (error || !data) throw new Error(`categoria 'dairy' non trovata: ${error?.message}`)
  return data.id
}

async function addFood(
  client: SupabaseClient,
  user: E2EUser,
  listId: string,
  name: string,
  imagePath: string | null = null
): Promise<string> {
  const { data, error } = await client
    .from('foods')
    .insert({
      list_id: listId,
      user_id: user.id,
      name,
      category_id: await categoryId(client),
      storage_location: 'fridge',
      expiry_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      image_url: imagePath,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`impossibile creare «${name}»: ${error?.message}`)
  return data.id
}

/** Toglie un alimento con il suo esito, come fa l'app dalla v1.11.0. */
async function removeWithOutcome(client: SupabaseClient, foodId: string): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await client
    .from('foods')
    .update({ deleted_at: now, status: 'wasted', consumed_at: now })
    .eq('id', foodId)
  if (error) throw new Error(`impossibile togliere l'alimento: ${error.message}`)
}

async function visibleFoods(client: SupabaseClient): Promise<{ name: string; status: string; deleted: boolean }[]> {
  const { data, error } = await client.from('foods').select('name, status, deleted_at').order('name')
  if (error) throw new Error(`lettura degli alimenti fallita: ${error.message}`)
  return (data ?? []).map((f) => ({ name: f.name, status: f.status, deleted: f.deleted_at !== null }))
}

async function canSign(client: SupabaseClient, path: string): Promise<boolean> {
  const { data, error } = await client.storage.from('food-images').createSignedUrl(path, 60)
  return !error && Boolean(data?.signedUrl)
}

async function deleteOwnAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('delete_user')
  if (error) throw new Error(`delete_user fallita: ${error.message}`)
}

test.describe('cancellazione account e lista condivisa (#152)', () => {
  test('chi ha creato la lista cancella l\'account: l\'altro membro tiene lista, alimenti e foto', async () => {
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const photos: string[] = []
    try {
      const creatorClient = await signInAsUser(creator.email, password)
      const memberClient = await signInAsUser(member.email, password)

      const creatorPhoto = await uploadE2EFoodImage(creator.id, `creator-${Date.now()}.jpg`)
      const memberPhoto = await uploadE2EFoodImage(member.id, `member-${Date.now()}.jpg`)
      photos.push(creatorPhoto, memberPhoto)

      await addFood(creatorClient, creator, listId, 'A · creato da chi ha creato la lista', creatorPhoto)
      const removed = await addFood(creatorClient, creator, listId, 'B · tolto da chi ha creato la lista')
      await removeWithOutcome(creatorClient, removed)
      await addFood(memberClient, member, listId, 'C · creato dall\'altro membro', memberPhoto)

      await deleteOwnAccount(creatorClient)

      expect(await listExists(listId)).toBe(true)
      expect(await visibleFoods(memberClient)).toEqual([
        { name: 'A · creato da chi ha creato la lista', status: 'active', deleted: false },
        { name: 'B · tolto da chi ha creato la lista', status: 'wasted', deleted: true },
        { name: 'C · creato dall\'altro membro', status: 'active', deleted: false },
      ])
      expect(await canSign(memberClient, creatorPhoto)).toBe(true)
      expect(await canSign(memberClient, memberPhoto)).toBe(true)
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })

  test('un membro che non ha creato la lista cancella l\'account: chi l\'ha creata tiene tutto', async () => {
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const photos: string[] = []
    try {
      const creatorClient = await signInAsUser(creator.email, password)
      const memberClient = await signInAsUser(member.email, password)

      const memberPhoto = await uploadE2EFoodImage(member.id, `member-${Date.now()}.jpg`)
      photos.push(memberPhoto)
      await addFood(memberClient, member, listId, 'creato dal membro che se ne va', memberPhoto)
      await addFood(creatorClient, creator, listId, 'creato da chi resta')

      await deleteOwnAccount(memberClient)

      expect((await visibleFoods(creatorClient)).map((f) => f.name)).toEqual([
        'creato da chi resta',
        'creato dal membro che se ne va',
      ])
      expect(await canSign(creatorClient, memberPhoto)).toBe(true)
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })

  test('dopo l\'uscita, chi è fuori dalla lista non vede né gli alimenti rimasti né le loro foto', async () => {
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const outsiderEmail = createE2EEmail()
    const outsider = await createE2EUser(outsiderEmail, password)
    const photos: string[] = []
    try {
      const creatorClient = await signInAsUser(creator.email, password)
      const creatorPhoto = await uploadE2EFoodImage(creator.id, `creator-${Date.now()}.jpg`)
      photos.push(creatorPhoto)
      await addFood(creatorClient, creator, listId, 'della lista condivisa', creatorPhoto)

      await deleteOwnAccount(creatorClient)

      const outsiderClient = await signInAsUser(outsider.email, password)
      expect((await visibleFoods(outsiderClient)).map((f) => f.name)).not.toContain('della lista condivisa')
      expect(await canSign(outsiderClient, creatorPhoto)).toBe(false)
      const { data: removedByOutsider } = await outsiderClient.storage.from('food-images').remove([creatorPhoto])
      expect(removedByOutsider ?? []).toHaveLength(0)
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(outsider.email)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })

  test('dopo l\'uscita, l\'altro membro può ancora togliere la foto rimasta nella cartella di chi se n\'è andato', async () => {
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const photos: string[] = []
    try {
      const creatorClient = await signInAsUser(creator.email, password)
      const creatorPhoto = await uploadE2EFoodImage(creator.id, `creator-${Date.now()}.jpg`)
      photos.push(creatorPhoto)
      await addFood(creatorClient, creator, listId, 'con la foto di chi se ne va', creatorPhoto)

      await deleteOwnAccount(creatorClient)

      // È il percorso della sostituzione della foto (#116): la vecchia va tolta.
      const memberClient = await signInAsUser(member.email, password)
      const { data: removedObjects, error } = await memberClient.storage.from('food-images').remove([creatorPhoto])
      expect(error).toBeNull()
      expect(removedObjects ?? []).toHaveLength(1)
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })

  test('dopo l\'uscita, chi conosce il percorso di una foto rimasta non se la prende puntandola da un alimento suo', async () => {
    // `image_url` lo scrive l'utente: se bastasse «un alimento delle mie liste
    // punta a questo oggetto», chiunque conosca un percorso — un ex membro, per
    // esempio — potrebbe leggerlo, sovrascriverlo e cancellarlo.
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const listId = await createListForUser(creator.id)
    const intruderEmail = createE2EEmail()
    const intruder = await createE2EUser(intruderEmail, password)
    const intruderList = await createListForUser(intruder.id)
    const photos: string[] = []
    try {
      const creatorClient = await signInAsUser(creator.email, password)
      const creatorPhoto = await uploadE2EFoodImage(creator.id, `creator-${Date.now()}.jpg`)
      photos.push(creatorPhoto)
      await addFood(creatorClient, creator, listId, 'con la foto da proteggere', creatorPhoto)

      await deleteOwnAccount(creatorClient)

      const intruderClient = await signInAsUser(intruder.email, password)
      await addFood(intruderClient, intruder, intruderList, 'punta alla foto altrui', creatorPhoto)
      expect(await canSign(intruderClient, creatorPhoto)).toBe(false)
      const { data: removedByIntruder } = await intruderClient.storage.from('food-images').remove([creatorPhoto])
      expect(removedByIntruder ?? []).toHaveLength(0)
    } finally {
      await removeE2EFoodImages(photos)
      await deleteList(listId)
      await deleteE2EUserByEmail(intruder.email)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
    }
  })

  test('una lista creata dall\'utente e rimasta senza membri va via con il suo account', async () => {
    // Si può uscire dalla propria lista (policy «Users can remove themselves
    // from lists»): la lista resta vuota, con i suoi alimenti. Sono dati single
    // di chi l'ha creata.
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    try {
      const client = await signInAsUser(user.email, password)
      await addFood(client, user, listId, 'nella lista lasciata')
      const { error } = await client.from('list_members').delete().eq('user_id', user.id)
      expect(error).toBeNull()

      await deleteOwnAccount(client)

      expect(await listExists(listId)).toBe(false)
    } finally {
      await deleteE2EUserByEmail(user.email)
    }
  })

  test('unico membro: la cancellazione porta via lista e alimenti, anche quelli tolti', async () => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    try {
      const client = await signInAsUser(user.email, password)
      await addFood(client, user, listId, 'in lista')
      const removed = await addFood(client, user, listId, 'tolto')
      await removeWithOutcome(client, removed)

      await deleteOwnAccount(client)

      expect(await listExists(listId)).toBe(false)
    } finally {
      await deleteE2EUserByEmail(user.email)
    }
  })

  test('cancellato dall\'amministrazione, e non da delete_user(), l\'utente non lascia dietro la sua lista', async () => {
    // Dalla dashboard di Supabase o con l'API admin si cancella la riga di
    // `auth.users` e basta: la regola «ciò che resta senza nessuno sparisce»
    // deve valere anche lì, non single dentro `delete_user()`.
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    const listId = await createListForUser(user.id)
    const client = await signInAsUser(user.email, password)
    await addFood(client, user, listId, 'di chi viene cancellato dall\'admin')

    await deleteE2EUserByEmail(user.email)

    expect(await listExists(listId)).toBe(false)
  })

  test('l\'anteprima della cancellazione distingue lista condivisa e unico membro, e conta single gli alimenti in lista', async () => {
    const singleEmail = createE2EEmail()
    const single = await createE2EUser(singleEmail, password)
    const singleList = await createListForUser(single.id)
    const creatorEmail = createE2EEmail()
    const creator = await createE2EUser(creatorEmail, password)
    const member = await makeUserListShared(creator.id, password)
    const sharedList = await createListForUser(creator.id)
    try {
      const singleClient = await signInAsUser(single.email, password)
      await addFood(singleClient, single, singleList, 'uno')
      await addFood(singleClient, single, singleList, 'due')
      await removeWithOutcome(singleClient, await addFood(singleClient, single, singleList, 'tolto'))

      const { data: singlePreview, error: singleError } = await singleClient.rpc('account_deletion_preview')
      expect(singleError).toBeNull()
      expect(singlePreview?.[0]).toEqual({
        list_shared: false,
        active_food_count: 2,
      })

      const creatorClient = await signInAsUser(creator.email, password)
      await addFood(creatorClient, creator, sharedList, 'condiviso')
      const { data: sharedPreview, error: sharedError } = await creatorClient.rpc('account_deletion_preview')
      expect(sharedError).toBeNull()
      expect(sharedPreview?.[0]).toEqual({
        list_shared: true,
        active_food_count: 1,
      })
    } finally {
      await deleteList(sharedList)
      await deleteE2EUserByEmail(member.email)
      await deleteE2EUserByEmail(creator.email)
      await deleteE2EUserByEmail(single.email)
    }
  })
})
