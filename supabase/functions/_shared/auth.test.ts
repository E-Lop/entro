import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { requireAuthenticatedUser, requireCronSecret } from './auth'

type DenoGlobal = { env?: { get: (name: string) => string | undefined } }

function stubDenoEnv(values: Record<string, string>): void {
  ;(globalThis as { Deno?: DenoGlobal }).Deno = {
    env: { get: (name: string) => values[name] },
  }
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://example.com/functions/v1/create-invite', {
    method: 'POST',
    headers,
  })
}

describe('requireAuthenticatedUser', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const client = { auth: { getUser: vi.fn() } }

    const result = await requireAuthenticatedUser(makeRequest(), client as never)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    expect(client.auth.getUser).not.toHaveBeenCalled()
  })

  it('returns 401 when the token is present but invalid', async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('bad token'),
        }),
      },
    }

    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: 'Bearer bogus' }),
      client as never,
    )

    expect((result as Response).status).toBe(401)
    expect(client.auth.getUser).toHaveBeenCalledWith('bogus')
  })

  it('returns the user for a valid token', async () => {
    const user = { id: 'user-123', email: 'a@b.it' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    }

    const result = await requireAuthenticatedUser(
      makeRequest({ Authorization: 'Bearer good' }),
      client as never,
    )

    expect(result).toEqual({ user })
  })
})

describe('requireCronSecret', () => {
  beforeEach(() => {
    stubDenoEnv({ CRON_SECRET: 'top-secret' })
  })

  afterEach(() => {
    delete (globalThis as { Deno?: DenoGlobal }).Deno
  })

  it('rejects a request without the secret', () => {
    const result = requireCronSecret(makeRequest())
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('rejects a wrong secret', () => {
    const result = requireCronSecret(makeRequest({ Authorization: 'Bearer wrong' }))
    expect((result as Response).status).toBe(401)
  })

  it('accepts the configured secret', () => {
    const result = requireCronSecret(makeRequest({ Authorization: 'Bearer top-secret' }))
    expect(result).toBeNull()
  })

  it('rejects everything when no secret is configured', () => {
    stubDenoEnv({})
    const result = requireCronSecret(makeRequest({ Authorization: 'Bearer top-secret' }))
    expect((result as Response).status).toBe(401)
  })
})
