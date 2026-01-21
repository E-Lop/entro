// Edge Function: validate-invite
// Validates invite by short code (public endpoint, no auth required)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateRequest {
  shortCode: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { shortCode }: ValidateRequest = await req.json()

    if (!shortCode) {
      return new Response(
        JSON.stringify({ error: 'Short code required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Lookup invite
    const { data: inviteData, error: inviteError } = await supabaseService
      .from('invites')
      .select('*')
      .eq('short_code', shortCode.toUpperCase())
      .single()

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({
          valid: false,
          invite: null,
          error: 'Invite not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check status
    if (inviteData.status !== 'pending') {
      return new Response(
        JSON.stringify({
          valid: false,
          invite: null,
          error: 'Invite already used or expired',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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

      return new Response(
        JSON.stringify({
          valid: false,
          invite: null,
          error: 'Invite expired',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
    return new Response(
      JSON.stringify({
        valid: true,
        invite: {
          listName: listName,
          creatorName: creatorName,
          expiresAt: inviteData.expires_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
