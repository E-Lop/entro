// Edge Function: validate-invite
// Validates invite token before signup (public endpoint, no auth required)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateRequest {
  token: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client with anon key (public access)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Parse request body
    const { token }: ValidateRequest = await req.json()

    // Validate input
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Find invite by token
    const { data: inviteData, error: inviteError } = await supabaseClient
      .from('invites')
      .select(`
        id,
        email,
        token,
        status,
        expires_at,
        list_id,
        lists (
          id,
          name
        )
      `)
      .eq('token', token)
      .single()

    if (inviteError || !inviteData) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Invalid invite token',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if invite is still pending
    if (inviteData.status !== 'pending') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'This invite has already been used',
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
          valid: false,
          error: 'This invite has expired',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Invite is valid - return info (without exposing sensitive data)
    return new Response(
      JSON.stringify({
        valid: true,
        invite: {
          email: inviteData.email,
          listName: inviteData.lists?.name || 'Una lista condivisa',
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
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
