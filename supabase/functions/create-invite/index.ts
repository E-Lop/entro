// Edge Function: create-invite
// Generates short invite code for anonymous sharing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { customAlphabet } from 'https://esm.sh/nanoid@4'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabase.ts'

interface InviteRequest {
  listId: string  // SOLO questo, no email!
}

// Solo generatore short code
const generateShortCode = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  6
)

// Generatore token per audit (opzionale, mai esposto)
const generateToken = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  32
)

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createServiceClient()

    const auth = await requireAuthenticatedUser(req, supabaseClient)
    if (auth instanceof Response) return auth
    const userId = auth.user.id

    // Parse request - SOLO listId
    const { listId }: InviteRequest = await req.json()

    if (!listId) {
      return errorResponse(req, 'listId is required', 400)
    }

    // Check user is member of list
    const { data: memberData, error: memberError } = await supabaseClient
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .single()

    if (memberError || !memberData) {
      return errorResponse(req, 'You are not a member of this list', 403)
    }

    // Generate unique short code with collision handling
    let shortCode: string = ''
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      shortCode = generateShortCode()

      const { data: existing } = await supabaseClient
        .from('invites')
        .select('id')
        .eq('short_code', shortCode)
        .maybeSingle()

      if (!existing) break
      attempts++
    }

    if (attempts === maxAttempts) {
      return errorResponse(req, 'Failed to generate unique code', 500)
    }

    // Set expiry (7 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create invite - SEMPLIFICATO
    const { error: inviteError } = await supabaseClient
      .from('invites')
      .insert({
        list_id: listId,
        email: null,  // No email needed
        short_code: shortCode,
        token: generateToken(),  // For audit only
        created_by: userId,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invite:', inviteError)
      return errorResponse(req, 'Failed to create invite', 500)
    }

    // Return SOLO shortCode
    return jsonResponse(
      req,
      {
        success: true,
        shortCode: shortCode,
      },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return errorResponse(req, 'Internal server error', 500)
  }
})
