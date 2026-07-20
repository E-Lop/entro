import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
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
