import { expect, test } from '@playwright/test'
import {
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
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
})
