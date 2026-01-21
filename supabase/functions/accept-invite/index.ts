// Edge Function: accept-invite
// Accepts invite by short code and adds user to shared list (requires authentication)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AcceptRequest {
  shortCode: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get authenticated user
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Parse request
    const { shortCode }: AcceptRequest = await req.json()

    if (!shortCode) {
      return new Response(
        JSON.stringify({ error: 'Short code required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Lookup invite
    const { data: inviteData, error: inviteError } = await supabaseClient
      .from('invites')
      .select('*')
      .eq('short_code', shortCode.toUpperCase())
      .single()

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({ error: 'Invite not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check status
    if (inviteData.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Invite already used or expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check expiry
    const expiresAt = new Date(inviteData.expires_at)
    if (expiresAt < new Date()) {
      await supabaseClient
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      return new Response(
        JSON.stringify({ error: 'Invite expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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

      return new Response(
        JSON.stringify({
          success: true,
          listId: inviteData.list_id,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
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
      return new Response(
        JSON.stringify({ error: 'Failed to add member' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Mark invite as accepted
    await supabaseClient
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)

    return new Response(
      JSON.stringify({
        success: true,
        listId: inviteData.list_id,
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
