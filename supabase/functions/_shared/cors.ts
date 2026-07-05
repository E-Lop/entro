const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://entroapp.it',
  'https://www.entroapp.it',
])

function getOptionalEnv(name: string): string | undefined {
  const deno = (globalThis as {
    Deno?: { env?: { get: (name: string) => string | undefined } }
  }).Deno

  return deno?.env?.get(name)
}

function configuredAllowedOrigins(): string[] {
  const value = getOptionalEnv('ENTRO_ALLOWED_ORIGINS')
  if (!value) return []

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  return DEFAULT_ALLOWED_ORIGINS.has(origin)
    || LOCAL_ORIGIN_PATTERN.test(origin)
    || configuredAllowedOrigins().includes(origin)
}

function mergeHeaders(base: HeadersInit, extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {}

  new Headers(base).forEach((value, key) => {
    headers[key] = value
  })

  if (extra) {
    new Headers(extra).forEach((value, key) => {
      headers[key] = value
    })
  }

  return headers
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }

  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  return headers
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null

  if (!isAllowedOrigin(req.headers.get('Origin'))) {
    return new Response(null, {
      status: 403,
      headers: { Vary: 'Origin' },
    })
  }

  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  })
}

export function rejectDisallowedOrigin(req: Request): Response | null {
  if (isAllowedOrigin(req.headers.get('Origin'))) return null
  return jsonResponse(req, { error: 'Origin not allowed' }, { status: 403 })
}

export function handleCors(req: Request): Response | null {
  return handleCorsPreflight(req) ?? rejectDisallowedOrigin(req)
}

export function jsonResponse(
  req: Request,
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: mergeHeaders(
      {
        ...getCorsHeaders(req),
        'Content-Type': 'application/json',
      },
      init.headers,
    ),
  })
}

export function errorResponse(
  req: Request,
  error: string,
  status = 500,
): Response {
  return jsonResponse(req, { error }, { status })
}
