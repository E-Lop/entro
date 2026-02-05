// Edge Function: create-invite
// Generates short invite code for anonymous sharing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { customAlphabet } from 'https://esm.sh/nanoid@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Parse request - SOLO listId
    const { listId }: InviteRequest = await req.json()

    if (!listId) {
      return new Response(
        JSON.stringify({ error: 'listId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check user is member of list
    const { data: memberData, error: memberError } = await supabaseClient
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .single()

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this list' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Failed to generate unique code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Failed to create invite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return SOLO shortCode
    return new Response(
      JSON.stringify({
        success: true,
        shortCode: shortCode,
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
