import { expect, test } from '@playwright/test'
import {
  countListMemberships,
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
  getInviteStatusByShortCode,
  isMember,
  listExists,
  seedAdditionalInviteForList,
  seedFoods,
  seedPendingInviteByCode,
  seedPendingInviteByEmail,
  signInAsUser,
} from './helpers/supabase'

const password = 'E2ePassword!2026'

test.describe('sicurezza join list_members', () => {
  test('un utente autenticato legge la propria lista', async () => {
    const email = createE2EEmail()
    const user = await createE2EUser(email, password)
    try {
      const client = await signInAsUser(email, password)
      // create_personal_list è idempotente e crea la lista personale
      const { data, error } = await client.rpc('create_personal_list')
      expect(error).toBeNull()
      expect(Array.isArray(data) ? data[0]?.success : (data as { success?: boolean })?.success).toBe(true)
    } finally {
      await deleteE2EUserByEmail(user.email)
    }
  })

  test('accept_pending_invite_by_email: joina l\'invito per la propria email', async () => {
    const inviterEmail = createE2EEmail()
    const inviter = await createE2EUser(inviterEmail, password)
    const inviteeEmail = createE2EEmail()
    const invitee = await createE2EUser(inviteeEmail, password)
    try {
      const listId = await seedPendingInviteByEmail(inviter.id, inviteeEmail)
      const client = await signInAsUser(inviteeEmail, password)
      const { data, error } = await client.rpc('accept_pending_invite_by_email')
      const row = Array.isArray(data) ? data[0] : data
      expect(error).toBeNull()
      expect(row?.success).toBe(true)
      expect(row?.list_id).toBe(listId)
    } finally {
      await deleteE2EUserByEmail(inviter.email)
      await deleteE2EUserByEmail(invitee.email)
    }
  })

  test('accept_pending_invite_by_email: NON joina un invito per un\'altra email', async () => {
    const inviterEmail = createE2EEmail()
    const inviter = await createE2EUser(inviterEmail, password)
    const otherEmail = createE2EEmail()
    const attackerEmail = createE2EEmail()
    const attacker = await createE2EUser(attackerEmail, password)
    try {
      await seedPendingInviteByEmail(inviter.id, otherEmail) // invito per otherEmail, non per l'attaccante
      const client = await signInAsUser(attackerEmail, password)
      const { data } = await client.rpc('accept_pending_invite_by_email')
      const row = Array.isArray(data) ? data[0] : data
      expect(row?.success).toBe(false) // no-op: nessun invito per la sua email
      expect(row?.list_id ?? null).toBeNull()
    } finally {
      await deleteE2EUserByEmail(inviter.email)
      await deleteE2EUserByEmail(attacker.email)
    }
  })
})

test('join_list_via_invite: codice valido, nessuna lista → join', async () => {
  const ownerEmail = createE2EEmail(); const owner = await createE2EUser(ownerEmail, password)
  const joinerEmail = createE2EEmail(); const joiner = await createE2EUser(joinerEmail, password)
  try {
    const { listId, shortCode } = await seedPendingInviteByCode(owner.id)
    const client = await signInAsUser(joinerEmail, password)
    const { data } = await client.rpc('join_list_via_invite', { p_short_code: shortCode })
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.success).toBe(true)
    expect(row?.requires_confirmation).toBe(false)
    expect(row?.list_id).toBe(listId)
  } finally {
    await deleteE2EUserByEmail(owner.email); await deleteE2EUserByEmail(joiner.email)
  }
})

test('join_list_via_invite: codice inesistente → errore, nessun join', async () => {
  const email = createE2EEmail(); const user = await createE2EUser(email, password)
  try {
    const client = await signInAsUser(email, password)
    const { data } = await client.rpc('join_list_via_invite', { p_short_code: 'NOPE0000' })
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.success).toBe(false)
    expect(row?.error_message).toBeTruthy()
  } finally { await deleteE2EUserByEmail(user.email) }
})

test('join_list_via_invite: utente con altra lista senza force → requires_confirmation + food_count', async () => {
  const ownerEmail = createE2EEmail(); const owner = await createE2EUser(ownerEmail, password)
  const joinerEmail = createE2EEmail(); const joiner = await createE2EUser(joinerEmail, password)
  try {
    // il joiner ha già una lista personale con 2 foods
    const joinerClient = await signInAsUser(joinerEmail, password)
    const { data: cpl } = await joinerClient.rpc('create_personal_list')
    const joinerListId = (Array.isArray(cpl) ? cpl[0] : cpl)?.list_id as string
    await seedFoods(joinerListId, joiner.id, 2)
    const { listId: invitedListId, shortCode } = await seedPendingInviteByCode(owner.id)
    const { data } = await joinerClient.rpc('join_list_via_invite', { p_short_code: shortCode })
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.requires_confirmation).toBe(true)
    expect(row?.food_count).toBe(2)
    // il ramo "richiede conferma" deve essere read-only: nessun side effect finché
    // l'utente non conferma esplicitamente con p_force
    expect(await isMember(joinerListId, joiner.id)).toBe(true) // ancora membro della propria lista
    expect(await isMember(invitedListId, joiner.id)).toBe(false) // non ancora membro della lista invitata
    expect(await getInviteStatusByShortCode(shortCode)).toBe('pending') // invito non consumato
  } finally {
    await deleteE2EUserByEmail(owner.email); await deleteE2EUserByEmail(joiner.email)
  }
})

test('join_list_via_invite: codice scaduto → errore, invito marcato expired, nessun join', async () => {
  const ownerEmail = createE2EEmail(); const owner = await createE2EUser(ownerEmail, password)
  const joinerEmail = createE2EEmail(); const joiner = await createE2EUser(joinerEmail, password)
  try {
    const { listId, shortCode } = await seedPendingInviteByCode(owner.id, {
      expiresAt: new Date(Date.now() - 60_000), // già scaduto
    })
    const client = await signInAsUser(joinerEmail, password)
    const { data } = await client.rpc('join_list_via_invite', { p_short_code: shortCode })
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.success).toBe(false)
    expect(row?.error_message).toBeTruthy()
    expect(await getInviteStatusByShortCode(shortCode)).toBe('expired') // marcato scaduto dalla RPC
    expect(await isMember(listId, joiner.id)).toBe(false)
  } finally {
    await deleteE2EUserByEmail(owner.email); await deleteE2EUserByEmail(joiner.email)
  }
})

test('join_list_via_invite: già membro della lista dell\'invito → success, invito accettato, nessuna membership duplicata', async () => {
  const ownerEmail = createE2EEmail(); const owner = await createE2EUser(ownerEmail, password)
  const joinerEmail = createE2EEmail(); const joiner = await createE2EUser(joinerEmail, password)
  try {
    // il joiner entra nella lista tramite un primo invito (join diretto, nessuna lista precedente)
    const { listId, shortCode: firstCode } = await seedPendingInviteByCode(owner.id)
    const client = await signInAsUser(joinerEmail, password)
    const first = await client.rpc('join_list_via_invite', { p_short_code: firstCode })
    const firstRow = Array.isArray(first.data) ? first.data[0] : first.data
    expect(firstRow?.success).toBe(true)

    // un secondo invito pending, ancora valido, punta alla STESSA lista di cui è già membro
    // (es. link duplicato/riutilizzato) → deve attivare il ramo "già membro"
    const secondCode = await seedAdditionalInviteForList(listId, owner.id)
    const second = await client.rpc('join_list_via_invite', { p_short_code: secondCode })
    const secondRow = Array.isArray(second.data) ? second.data[0] : second.data
    expect(secondRow?.success).toBe(true)
    expect(secondRow?.list_id).toBe(listId)
    expect(await getInviteStatusByShortCode(secondCode)).toBe('accepted')

    // nessuna riga list_members duplicata per (utente, lista)
    expect(await countListMemberships(listId, joiner.id)).toBe(1)
  } finally {
    await deleteE2EUserByEmail(owner.email); await deleteE2EUserByEmail(joiner.email)
  }
})

test('join_list_via_invite: force → swap, e la vecchia lista senza membri viene cancellata (cascade foods)', async () => {
  const ownerEmail = createE2EEmail(); const owner = await createE2EUser(ownerEmail, password)
  const joinerEmail = createE2EEmail(); const joiner = await createE2EUser(joinerEmail, password)
  try {
    const joinerClient = await signInAsUser(joinerEmail, password)
    const { data: cpl } = await joinerClient.rpc('create_personal_list')
    const oldListId = (Array.isArray(cpl) ? cpl[0] : cpl)?.list_id as string
    await seedFoods(oldListId, joiner.id, 1)
    const { listId: newListId, shortCode } = await seedPendingInviteByCode(owner.id)
    const { data } = await joinerClient.rpc('join_list_via_invite', { p_short_code: shortCode, p_force: true })
    const row = Array.isArray(data) ? data[0] : data
    expect(row?.success).toBe(true)
    expect(row?.list_id).toBe(newListId)
    // la vecchia lista (ultimo membro rimosso) è stata cancellata → foods in cascade
    expect(await listExists(oldListId)).toBe(false)
  } finally {
    await deleteE2EUserByEmail(owner.email); await deleteE2EUserByEmail(joiner.email)
  }
})
