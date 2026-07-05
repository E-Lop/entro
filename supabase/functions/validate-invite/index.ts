// Edge Function: validate-invite
// Validates invite by short code (public endpoint, no auth required)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { createServiceClient } from '../_shared/supabase.ts'

interface ValidateRequest {
  shortCode: string
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabaseService = createServiceClient()

    const { shortCode }: ValidateRequest = await req.json()

    if (!shortCode) {
      return errorResponse(req, 'Short code required', 400)
    }

    // Lookup invite
    const { data: inviteData, error: inviteError } = await supabaseService
      .from('invites')
      .select('*')
      .eq('short_code', shortCode.toUpperCase())
      .single()

    if (inviteError || !inviteData) {
      return jsonResponse(
        req,
        {
          valid: false,
          invite: null,
          error: 'Invite not found',
        },
        { status: 404 },
      )
    }

    // Check status
    if (inviteData.status !== 'pending') {
      return jsonResponse(
        req,
        {
          valid: false,
          invite: null,
          error: 'Invite already used or expired',
        },
      )
    }

    // Check expiry
    const expiresAt = new Date(inviteData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      // Mark as expired
      await supabaseService
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      return jsonResponse(
        req,
        {
          valid: false,
          invite: null,
          error: 'Invite expired',
        },
      )
    }

    // Get list and creator info
    const { data: listData } = await supabaseService
      .from('lists')
      .select('name, created_by')
      .eq('id', inviteData.list_id)
      .single()

    const listName = listData?.name || 'Una lista condivisa'

    // Get creator name
    let creatorName = 'Un utente'
    if (listData?.created_by) {
      const { data: { user: creatorUser } } = await supabaseService.auth.admin.getUserById(
        listData.created_by
      )

      if (creatorUser?.user_metadata?.full_name) {
        creatorName = creatorUser.user_metadata.full_name
      }
    }

    // Return valid invite - NO email in response
    return jsonResponse(
      req,
      {
        valid: true,
        invite: {
          listName: listName,
          creatorName: creatorName,
          expiresAt: inviteData.expires_at,
        },
      },
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return errorResponse(req, 'Internal server error', 500)
  }
})
