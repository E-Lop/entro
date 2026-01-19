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
    // Create client for user authentication (with anon key)
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get authenticated user from JWT
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser()

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

    // Create service role client for admin operations
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

    // Send invite email using Supabase Auth
    // Note: This requires email templates to be configured in Supabase dashboard
    const { error: emailError } = await supabaseClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          invite_token: inviteToken,
          invite_url: inviteUrl,
          list_name: listName,
        },
        redirectTo: inviteUrl,
      }
    )

    if (emailError) {
      console.error('Error sending invite email:', emailError)
      // Don't fail the request if email fails - invite is still created
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite: inviteData,
        message: `Invite sent to ${email}`,
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
