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
  it('returns failure when user is not authenticated', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(false)
  })

  it('returns failure when user has no email', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: null } },
    })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(false)
    expect(result.error).toBeNull()
  })

  it('returns failure with no error when no pending invite found', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
    })
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(false)
    expect(result.error).toBeNull()
  })

  it('marks invite as expired when expires_at is in the past', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
    })

    const expiredInvite = {
      id: 'inv1',
      list_id: 'list1',
      expires_at: '2020-01-01T00:00:00Z',
      status: 'pending',
      pending_user_email: 'test@example.com',
    }

    mockBuilder.maybeSingle.mockResolvedValueOnce({ data: expiredInvite, error: null })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    expect(mockFrom).toHaveBeenCalledWith('invites')
    expect(mockBuilder.update).toHaveBeenCalledWith({ status: 'expired' })
  })

  it('marks invite as accepted when user is already a member', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
    })

    const validInvite = {
      id: 'inv1',
      list_id: 'list1',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'pending',
      pending_user_email: 'test@example.com',
    }

    mockBuilder.maybeSingle
      .mockResolvedValueOnce({ data: validInvite, error: null })
      .mockResolvedValueOnce({ data: { list_id: 'list1', user_id: 'u1' }, error: null })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(true)
    expect(result.listId).toBe('list1')
    expect(mockBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted' })
    )
  })

  it('happy path: inserts member and accepts invite', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'test@example.com' } },
    })

    const validInvite = {
      id: 'inv1',
      list_id: 'list1',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'pending',
      pending_user_email: 'test@example.com',
    }

    mockBuilder.maybeSingle
      .mockResolvedValueOnce({ data: validInvite, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    mockBuilder.insert.mockReturnValue({ error: null })

    const result = await acceptInviteByEmail()

    expect(result.success).toBe(true)
    expect(result.listId).toBe('list1')
    expect(mockBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: 'list1', user_id: 'u1' })
    )
  })

  it('uses ilike for case-insensitive email matching', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'User@Test.COM' } },
    })
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    await acceptInviteByEmail()

    expect(mockBuilder.ilike).toHaveBeenCalledWith('pending_user_email', 'user@test.com')
  })
})

// ─── acceptInviteWithConfirmation ──────────────────────────────────

describe('acceptInviteWithConfirmation', () => {
  beforeEach(() => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'u1' } },
    })
  })

  it('returns error when invite is not found', async () => {
    mockBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const result = await acceptInviteWithConfirmation('ABCDEF')

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('marks invite expired and returns error when expired', async () => {
    const expiredInvite = {
      id: 'inv1',
      list_id: 'list1',
      short_code: 'ABCDEF',
      expires_at: '2020-01-01T00:00:00Z',
      status: 'pending',
    }
    mockBuilder.maybeSingle.mockResolvedValueOnce({ data: expiredInvite, error: null })

    const result = await acceptInviteWithConfirmation('ABCDEF')

    expect(result.success).toBe(false)
    expect(mockBuilder.update).toHaveBeenCalledWith({ status: 'expired' })
  })

  it('adds user directly when user has no list', async () => {
    const invite = {
      id: 'inv1',
      list_id: 'list1',
      short_code: 'ABCDEF',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'pending',
    }

    mockBuilder.maybeSingle
      .mockResolvedValueOnce({ data: invite, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    mockBuilder.insert.mockReturnValue({ error: null })

    const result = await acceptInviteWithConfirmation('ABCDEF')

    expect(result.success).toBe(true)
    expect(result.listId).toBe('list1')
  })

  it('is idempotent when user is already in the same list', async () => {
    const invite = {
      id: 'inv1',
      list_id: 'list1',
      short_code: 'ABCDEF',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'pending',
    }

    mockBuilder.maybeSingle
      .mockResolvedValueOnce({ data: invite, error: null })
      .mockResolvedValueOnce({ data: { list_id: 'list1' }, error: null })

    const result = await acceptInviteWithConfirmation('ABCDEF')

    expect(result.success).toBe(true)
    expect(result.listId).toBe('list1')
    expect(mockBuilder.insert).not.toHaveBeenCalled()
  })

  it('forceAccept: removes from old list and adds to new', async () => {
    const invite = {
      id: 'inv1',
      list_id: 'new-list',
      short_code: 'ABCDEF',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'pending',
    }

    mockBuilder.maybeSingle
      .mockResolvedValueOnce({ data: invite, error: null })
      .mockResolvedValueOnce({ data: { list_id: 'old-list' }, error: null })

    // After the two maybeSingle calls, the function does many from() calls.
    // We use mockImplementation to return different builders per call.
    let fromCallCount = 0
    mockFrom.mockImplementation((() => {
      fromCallCount++
      if (fromCallCount <= 2) return mockBuilder // first 2 use maybeSingle
      if (fromCallCount === 3) {
        // foods count
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }
      }
      if (fromCallCount === 4) {
        // delete from list_members
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }
      if (fromCallCount === 5) {
        // count remaining members
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
          }),
        }
      }
      if (fromCallCount === 6) {
        // insert new member
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      // update invite status
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any)

    const result = await acceptInviteWithConfirmation('ABCDEF', true)

    expect(result.success).toBe(true)
    expect(result.listId).toBe('new-list')
  })
})

// ─── registerPendingInvite ─────────────────────────────────────────

describe('registerPendingInvite', () => {
  it('normalizes email (trim + lowercase)', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    mockFrom.mockReturnValue({ update: updateMock     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    await registerPendingInvite('ABCDEF', ' User@TEST.com ')

    expect(mockFrom).toHaveBeenCalledWith('invites')
    expect(updateMock).toHaveBeenCalledWith({ pending_user_email: 'user@test.com' })
  })

  it('returns success when update succeeds', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const result = await registerPendingInvite('ABCDEF', 'test@example.com')

    expect(result.success).toBe(true)
    expect(result.error).toBeNull()
  })

  it('returns error when supabase fails', async () => {
    const supabaseError = { message: 'DB error', code: '42P01' }
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: supabaseError }),
        }),
      }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

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
