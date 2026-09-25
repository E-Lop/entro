// @vitest-environment jsdom
/**
 * Il codice invito viaggia nei metadati della registrazione (#165).
 *
 * Il trigger `on_auth_user_created` lo legge da `raw_user_meta_data` e mette
 * l'utente nella lista di chi l'ha invitato mentre lo crea. Prima il codice
 * arrivava dopo, con `register_pending_invite`, quando il trigger aveva già
 * dato all'utente una lista sua: l'invito non si accettava più.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSignUp } = vi.hoisted(() => ({ mockSignUp: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signUp: mockSignUp } },
}))

import { signUp } from '@/lib/auth'

describe('signUp e codice invito', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null })
  })

  it('passa il codice nei metadati, in maiuscolo', async () => {
    await signUp('a@example.test', 'Password!2026', 'Anna', 'ab12cd')

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@example.test',
      password: 'Password!2026',
      options: { data: { full_name: 'Anna', invite_code: 'AB12CD' } },
    })
  })

  it('senza codice i metadati hanno solo il nome', async () => {
    await signUp('a@example.test', 'Password!2026', 'Anna')

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@example.test',
      password: 'Password!2026',
      options: { data: { full_name: 'Anna' } },
    })
  })
})
