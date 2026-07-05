import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse } from './cors.ts'

interface AuthenticatedUser {
  user: User
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return null

  const token = authHeader.slice('Bearer '.length).trim()
  return token || null
}

export async function requireAuthenticatedUser(
  req: Request,
  supabaseClient: SupabaseClient,
): Promise<AuthenticatedUser | Response> {
  const token = getBearerToken(req)
  if (!token) {
    return errorResponse(req, 'Missing authorization token', 401)
  }

  const { data: { user }, error } = await supabaseClient.auth.getUser(token)
  if (error || !user) {
    return errorResponse(req, 'Unauthorized', 401)
  }

  return { user }
}

export function requireCronSecret(req: Request): Response | null {
  const token = getBearerToken(req)
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  if (!cronSecret || token !== cronSecret) {
    return errorResponse(req, 'Unauthorized', 401)
  }

  return null
}
