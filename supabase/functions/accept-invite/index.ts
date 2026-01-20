// Edge Function: accept-invite
// Accepts invite and adds user to shared list (requires authentication)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AcceptRequest {
  token?: string  // Optional - will accept by email if not provided
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client with service role key
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

    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(
      token
    )

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const userId = userData.user.id
    const userEmail = userData.user.email

    // Parse request body
    const { token: inviteToken }: AcceptRequest = await req.json()

    let inviteData

    if (inviteToken) {
      // Accept by token - find invite by token
      const { data, error: inviteError } = await supabaseClient
        .from('invites')
        .select('*')
        .eq('token', inviteToken)
        .single()

      if (inviteError || !data) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid invite token',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Verify email matches
      if (data.email !== userEmail) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'This invite was sent to a different email address',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      inviteData = data
    } else {
      // Accept by email - find pending invite for this email
      const { data, error: inviteError } = await supabaseClient
        .from('invites')
        .select('*')
        .eq('email', userEmail)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (inviteError || !data) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No pending invite found for your email',
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      inviteData = data
    }

    // Check if invite is still pending
    if (inviteData.status !== 'pending') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'This invite has already been used or expired',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if invite has expired
    const expiresAt = new Date(inviteData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      // Update invite status to expired
      await supabaseClient
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'This invite has expired',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user is already a member of this list
    const { data: existingMember } = await supabaseClient
      .from('list_members')
      .select('*')
      .eq('list_id', inviteData.list_id)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      // User is already a member, just mark invite as accepted
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
          message: 'You are already a member of this list',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Add user to list_members (atomic operation)
    const { error: memberError } = await supabaseClient
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (memberError) {
      console.error('Error adding user to list:', memberError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to add you to the list',
          details: memberError,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update invite status to accepted
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
        message: 'Successfully joined the shared list!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
