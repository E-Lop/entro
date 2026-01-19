// Edge Function: create-invite
// Generates invite token and sends email to invite user to shared list

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { customAlphabet } from 'https://esm.sh/nanoid@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteRequest {
  email: string
  listId: string
}

// Generate secure 32-character token using nanoid
const generateToken = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  32
)

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key
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

    // Extract JWT token from Authorization header
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      console.error('No authorization token provided')
      return new Response(
        JSON.stringify({ error: 'Missing authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Validating JWT token...')

    // Get authenticated user from JWT token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError) {
      console.error('JWT validation error:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError.message }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!user) {
      console.error('No user found from token')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('User authenticated:', user.id)

    const userId = user.id

    // Parse request body
    const { email, listId }: InviteRequest = await req.json()

    // Validate input
    if (!email || !listId) {
      return new Response(
        JSON.stringify({ error: 'Email and listId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user is a member of the list
    const { data: memberData, error: memberError } = await supabaseClient
      .from('list_members')
      .select('*')
      .eq('list_id', listId)
      .eq('user_id', userId)
      .single()

    if (memberError || !memberData) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this list' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if email is already a member of the list
    const { data: existingMember } = await supabaseClient
      .from('list_members')
      .select('user_id, auth.users!inner(email)')
      .eq('list_id', listId)

    // Note: Due to RLS, we need to check via invites or a different approach
    // For now, we'll allow duplicate invites (they can be filtered later)

    // Generate unique token
    const inviteToken = generateToken()

    // Set expiry date (7 days from now)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create invite record
    const { data: inviteData, error: inviteError } = await supabaseClient
      .from('invites')
      .insert({
        list_id: listId,
        email: email,
        token: inviteToken,
        created_by: userId,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Error creating invite:', inviteError)
      return new Response(
        JSON.stringify({ error: 'Failed to create invite', details: inviteError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get list details for email
    const { data: listData } = await supabaseClient
      .from('lists')
      .select('name')
      .eq('id', listId)
      .single()

    const listName = listData?.name || 'Una lista condivisa'

    // Construct invite URL
    const appUrl = Deno.env.get('APP_URL') || 'https://entro-il.netlify.app'
    const inviteUrl = `${appUrl}/signup?invite_token=${inviteToken}`

    // TODO: Integrate email service (Resend, SendGrid, etc.)
    // For now, return the invite URL for manual sharing
    console.log('Invite created successfully. URL:', inviteUrl)

    return new Response(
      JSON.stringify({
        success: true,
        invite: inviteData,
        inviteUrl: inviteUrl,
        message: `Invite created for ${email}. Share this link: ${inviteUrl}`,
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
