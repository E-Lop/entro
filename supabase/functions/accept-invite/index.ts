// Edge Function: accept-invite
// Accepts invite by short code and adds user to shared list (requires authentication)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { requireAuthenticatedUser } from '../_shared/auth.ts'
import { createServiceClient } from '../_shared/supabase.ts'

interface AcceptRequest {
  shortCode: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseClient = createServiceClient()

    const auth = await requireAuthenticatedUser(req, supabaseClient)
    if (auth instanceof Response) return auth
    const userId = auth.user.id

    // Parse request
    const { shortCode }: AcceptRequest = await req.json()

    if (!shortCode) {
      return errorResponse(req, 'Short code required', 400)
    }

    // Lookup invite
    const { data: inviteData, error: inviteError } = await supabaseClient
      .from('invites')
      .select('*')
      .eq('short_code', shortCode.toUpperCase())
      .single()

    if (inviteError || !inviteData) {
      return errorResponse(req, 'Invite not found', 404)
    }

    // Check status
    if (inviteData.status !== 'pending') {
      return errorResponse(req, 'Invite already used or expired', 400)
    }

    // Check expiry
    const expiresAt = new Date(inviteData.expires_at)
    if (expiresAt < new Date()) {
      await supabaseClient
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      return errorResponse(req, 'Invite expired', 400)
    }

    // NO EMAIL MATCH CHECK - anyone with code can use it!

    // Check if already member
    const { data: existingMember } = await supabaseClient
      .from('list_members')
      .select('*')
      .eq('list_id', inviteData.list_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
      // Already a member, just mark invite as accepted
      await supabaseClient
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id)

      return jsonResponse(
        req,
        {
          success: true,
          listId: inviteData.list_id,
        },
      )
    }

    // Add to list_members
    const { error: memberError } = await supabaseClient
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      return errorResponse(req, 'Failed to add member', 500)
    }

    // Mark invite as accepted
    await supabaseClient
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)

    return jsonResponse(
      req,
      {
        success: true,
        listId: inviteData.list_id,
      },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return errorResponse(req, 'Internal server error', 500)
  }
})
