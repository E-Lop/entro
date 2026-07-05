import { describe, expect, it } from 'vitest'
import {
  getCorsHeaders,
  handleCorsPreflight,
  isAllowedOrigin,
  rejectDisallowedOrigin,
} from './cors'

describe('edge function CORS helpers', () => {
  it('allows production and localhost origins', () => {
    expect(isAllowedOrigin('https://entroapp.it')).toBe(true)
    expect(isAllowedOrigin('https://www.entroapp.it')).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:54321')).toBe(true)
  })

  it('allows requests without Origin for cron and server-to-server calls', () => {
    expect(isAllowedOrigin(null)).toBe(true)

    const request = new Request('https://example.com/functions/v1/send-expiry-notifications')
    expect(rejectDisallowedOrigin(request)).toBeNull()
  })

  it('echoes the allowed origin instead of using a wildcard', () => {
    const request = new Request('https://example.com/functions/v1/create-invite', {
      headers: { Origin: 'https://entroapp.it' },
    })

    expect(getCorsHeaders(request)['Access-Control-Allow-Origin']).toBe('https://entroapp.it')
  })

  it('rejects disallowed browser origins before running function logic', async () => {
    const request = new Request('https://example.com/functions/v1/create-invite', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    })

    const preflight = handleCorsPreflight(request)
    expect(preflight?.status).toBe(403)

    const rejection = rejectDisallowedOrigin(request)
    expect(rejection?.status).toBe(403)
    await expect(rejection?.json()).resolves.toEqual({ error: 'Origin not allowed' })
  })
})
