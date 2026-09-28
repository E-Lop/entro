import { expect, test } from '@playwright/test'
import {
  E2E_PASSWORD,
  listUsersPage,
  createE2EEmail,
  createE2EUser,
  deleteE2EUserByEmail,
  findUserByEmail,
  type E2EUser,
} from './helpers/supabase'

// La ricerca per email scorre tutte le pagine di `listUsers()` (#186).
//
// Senza parametri GoTrue restituisce 50 utenti, dal più recente: chi cercava
// nella prima pagina un utente vecchio non lo trovava, senza errore. Qui la
// pagina è di un utente solo, così il più vecchio dei tre sta almeno alla terza.

test.describe('ricerca di un utente per email', () => {
  const users: E2EUser[] = []

  test.beforeAll(async () => {
    for (let i = 0; i < 3; i++) users.push(await createE2EUser(createE2EEmail(), E2E_PASSWORD))
  })

  test.afterAll(async () => {
    for (const user of users) await deleteE2EUserByEmail(user.email)
  })

  test('trova un utente che non sta nella prima pagina', async () => {
    const oldest = users[0]
    // Senza questo il test potrebbe passare anche con una ricerca a pagina sola.
    const firstPage = await listUsersPage(1, 1)
    expect(firstPage.map((user) => user.email)).not.toContain(oldest.email)

    const found = await findUserByEmail(oldest.email, 1)
    expect(found?.id).toBe(oldest.id)
  })

  test('restituisce null per un’email che non esiste', async () => {
    expect(await findUserByEmail(createE2EEmail(), 2)).toBeNull()
  })
})
