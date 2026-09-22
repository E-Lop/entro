import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  createListForUser,
  deleteE2EUserByEmail,
  deleteList,
  listExists,
  makeUserListShared,
  seedPendingInviteByCode,
  signInAsUser,
} from './helpers/supabase'

/**
 * #147 — l'avviso prima di accettare un invito dice ciò che succede davvero.
 *
 * Accettando un invito si lascia la lista in cui si è. La lista si cancella, con
 * i suoi alimenti, solo se chi esce ne era l'unico membro; se è condivisa, resta
 * agli altri. L'avviso invece annunciava sempre «saranno eliminati», e il numero
 * contava anche gli alimenti già tolti. La RPC ora dice in quale caso si è
 * (`only_member`) e conta solo gli alimenti in lista.
 */

const password = 'E2ePassword!2026'

async function addFoods(email: string, listId: string, userId: string, names: string[], removed: string[] = []) {
  const client = await signInAsUser(email, password)
  const { data: category } = await client.from('categories').select('id').eq('name', 'dairy').single()
  const now = new Date().toISOString()
  const rows = [...names, ...removed].map((name) => ({
    list_id: listId,
    user_id: userId,
    name,
    category_id: category!.id,
    storage_location: 'fridge',
    expiry_date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
    ...(removed.includes(name) ? { deleted_at: now, status: 'wasted', consumed_at: now } : {}),
  }))
  const { error } = await client.from('foods').insert(rows)
  if (error) throw new Error(`impossibile creare gli alimenti: ${error.message}`)
}

test.describe('avviso prima di accettare un invito (#147)', () => {
  test('da unico membro: conferma richiesta, only_member, e contati solo gli alimenti in lista', async () => {
    const ownerEmail = createE2EEmail()
    const owner = await createE2EUser(ownerEmail, password)
    const joinerEmail = createE2EEmail()
    const joiner = await createE2EUser(joinerEmail, password)
    try {
      const { shortCode } = await seedPendingInviteByCode(owner.id)
      const joinerList = await createListForUser(joiner.id)
      await addFoods(joinerEmail, joinerList, joiner.id, ['uno', 'due'], ['tolto'])

      const client = await signInAsUser(joinerEmail, password)
      const { data, error } = await client.rpc('join_list_via_invite', { p_short_code: shortCode, p_force: false })
      expect(error).toBeNull()
      expect(data?.[0]).toMatchObject({ requires_confirmation: true, only_member: true, food_count: 2 })
    } finally {
      await deleteE2EUserByEmail(joiner.email)
      await deleteE2EUserByEmail(owner.email)
    }
  })

  test('da una lista condivisa: conferma richiesta, non only_member, e lasciandola la lista resta all\'altro membro', async () => {
    const ownerEmail = createE2EEmail()
    const owner = await createE2EUser(ownerEmail, password)
    const joinerEmail = createE2EEmail()
    const joiner = await createE2EUser(joinerEmail, password)
    const coMember = await makeUserListShared(joiner.id, password)
    const sharedList = await createListForUser(joiner.id)
    try {
      const { shortCode } = await seedPendingInviteByCode(owner.id)
      await addFoods(joinerEmail, sharedList, joiner.id, ['della lista condivisa'])

      const client = await signInAsUser(joinerEmail, password)
      const { data: ask } = await client.rpc('join_list_via_invite', { p_short_code: shortCode, p_force: false })
      expect(ask?.[0]).toMatchObject({ requires_confirmation: true, only_member: false })

      const { data: joined } = await client.rpc('join_list_via_invite', { p_short_code: shortCode, p_force: true })
      expect(joined?.[0]).toMatchObject({ success: true })
      expect(await listExists(sharedList)).toBe(true)
      const coMemberClient = await signInAsUser(coMember.email, password)
      const { data: coMemberFoods } = await coMemberClient.from('foods').select('name')
      expect(coMemberFoods).toEqual([{ name: 'della lista condivisa' }])
    } finally {
      await deleteList(sharedList)
      await deleteE2EUserByEmail(coMember.email)
      await deleteE2EUserByEmail(joiner.email)
      await deleteE2EUserByEmail(owner.email)
    }
  })
})
