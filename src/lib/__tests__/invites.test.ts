import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so these are available inside the vi.mock factory
const { mockAuth, mockBuilder, mockFrom, mockRpc } = vi.hoisted(() => {
  const mockAuth = {
    getUser: vi.fn(),
    getSession: vi.fn(),
  }

  const mockBuilder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  const mockFrom = vi.fn(() => mockBuilder)
  const mockRpc = vi.fn()

  return { mockAuth, mockBuilder, mockFrom, mockRpc }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
    from: mockFrom,
    rpc: mockRpc,
  },
}))

import {
  acceptInviteByEmail,
  acceptInviteWithConfirmation,
  registerPendingInvite,
  leaveSharedList,
} from '../invites'

function resetBuilder() {
  for (const key of Object.keys(mockBuilder)) {
    mockBuilder[key].mockReset()
  }
  mockBuilder.select.mockReturnThis()
  mockBuilder.insert.mockReturnThis()
  mockBuilder.update.mockReturnThis()
  mockBuilder.delete.mockReturnThis()
  mockBuilder.eq.mockReturnThis()
  mockBuilder.neq.mockReturnThis()
  mockBuilder.ilike.mockReturnThis()
  mockBuilder.order.mockReturnThis()
  mockBuilder.limit.mockReturnThis()
  mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })
  mockBuilder.single.mockResolvedValue({ data: null, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetBuilder()
  mockFrom.mockReturnValue(mockBuilder)
})

// ─── acceptInviteByEmail ───────────────────────────────────────────

describe('acceptInviteByEmail', () => {
  it('chiama la RPC accept_pending_invite_by_email e mappa il successo', async () => {
    mockRpc.mockResolvedValue({ data: [{ list_id: 'list-1', success: true, error_message: null }], error: null })
    const result = await acceptInviteByEmail()
    expect(mockRpc).toHaveBeenCalledWith('accept_pending_invite_by_email')
    expect(result).toEqual({ success: true, listId: 'list-1', error: null })
  })

  it('ritorna no-op quando non c\'è invito', async () => {
    mockRpc.mockResolvedValue({ data: [{ list_id: null, success: false, error_message: null }], error: null })
    const result = await acceptInviteByEmail()
    expect(result.success).toBe(false)
    expect(result.listId).toBeNull()
    expect(result.error).toBeNull()
  })
})

// ─── acceptInviteWithConfirmation ──────────────────────────────────

describe('acceptInviteWithConfirmation', () => {
  it('chiama join_list_via_invite e propaga requires_confirmation + foodCount', async () => {
    mockRpc.mockResolvedValue({ data: [{ list_id: null, success: false, requires_confirmation: true, food_count: 3, error_message: null }], error: null })
    const result = await acceptInviteWithConfirmation('abc123')
    expect(mockRpc).toHaveBeenCalledWith('join_list_via_invite', { p_short_code: 'ABC123', p_force: false })
    expect(result.requiresConfirmation).toBe(true)
    expect(result.foodCount).toBe(3)
  })

  it('mappa il successo con list_id', async () => {
    mockRpc.mockResolvedValue({ data: [{ list_id: 'list-9', success: true, requires_confirmation: false, food_count: null, error_message: null }], error: null })
    const result = await acceptInviteWithConfirmation('abc123', true)
    expect(mockRpc).toHaveBeenCalledWith('join_list_via_invite', { p_short_code: 'ABC123', p_force: true })
    expect(result).toMatchObject({ success: true, listId: 'list-9', requiresConfirmation: false })
  })
})

// ─── registerPendingInvite ─────────────────────────────────────────

describe('registerPendingInvite', () => {
  it('calls the register_pending_invite RPC with normalized email (trim + lowercase)', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    await registerPendingInvite('ABCDEF', ' User@TEST.com ')

    expect(mockRpc).toHaveBeenCalledWith('register_pending_invite', {
      p_short_code: 'ABCDEF',
      p_email: 'user@test.com',
    })
  })

  it('returns success when the RPC succeeds', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    const result = await registerPendingInvite('ABCDEF', 'test@example.com')

    expect(result.success).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns error when the RPC fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } })

    const result = await registerPendingInvite('ABCDEF', 'test@example.com')

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

// ─── leaveSharedList ───────────────────────────────────────────────

describe('leaveSharedList', () => {
  beforeEach(() => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
    })
  })

  it('returns error when user is not in any list', async () => {
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await leaveSharedList()

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('lista')
  })

  it('returns error when list has only 1 member (personal list)', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation((() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { list_id: 'list1' },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
        }),
      }
    }    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any)

    const result = await leaveSharedList()

    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('personale')
  })

  it('happy path: removes member and creates personal list via RPC', async () => {
    let fromCallCount = 0
    mockFrom.mockImplementation((() => {
      fromCallCount++
      if (fromCallCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { list_id: 'shared-list' },
            error: null,
          }),
        }
      }
      if (fromCallCount === 2) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        }
      }
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }
    }    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any)

    mockRpc.mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { success: true, list_id: 'new-personal', error_message: null },
        error: null,
      }),
    })

    const result = await leaveSharedList()

    expect(result.success).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('create_personal_list')
  })
})
