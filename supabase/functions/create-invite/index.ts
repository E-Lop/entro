// Edge Function: create-invite
// Generates invite token and sends email to invite user to shared list

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { customAlphabet } from 'https://esm.sh/nanoid@4'
import { Resend } from 'https://esm.sh/resend@3'

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

    // Get list details and creator name for email
    const { data: listData } = await supabaseClient
      .from('lists')
      .select('name')
      .eq('id', listId)
      .single()

    const listName = listData?.name || 'Una lista condivisa'

    // Get creator's name from auth metadata
    const { data: { user: creatorUser } } = await supabaseClient.auth.admin.getUserById(userId)
    const creatorName = creatorUser?.user_metadata?.full_name || 'Un utente'

    // Construct invite URL
    const appUrl = Deno.env.get('APP_URL') || 'https://entro-il.netlify.app'
    const inviteUrl = `${appUrl}/signup?invite_token=${inviteToken}`

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({
          error: 'Email service not configured. Contact administrator.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const resend = new Resend(resendApiKey)

    // Create HTML email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invito su entro</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🗓️ entro</h1>
          </div>

          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1f2937; margin-top: 0; font-size: 24px;">Sei stato invitato! 🎉</h2>

            <p style="font-size: 16px; color: #4b5563; margin: 20px 0;">
              <strong>${creatorName}</strong> ti ha invitato a condividere la sua lista di alimenti su <strong>entro</strong>.
            </p>

            <p style="font-size: 16px; color: #4b5563; margin: 20px 0;">
              Insieme potrete:
            </p>

            <ul style="color: #4b5563; font-size: 16px; line-height: 1.8;">
              <li>Vedere gli stessi alimenti in tempo reale</li>
              <li>Aggiungere nuovi prodotti</li>
              <li>Modificare le scadenze</li>
              <li>Evitare sprechi alimentari insieme</li>
            </ul>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${inviteUrl}"
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                Accetta Invito
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin: 30px 0 10px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <strong>Nota:</strong> Questo invito scadrà tra 7 giorni. Se non hai un account, ne creerai uno durante il processo di registrazione.
            </p>

            <p style="font-size: 12px; color: #9ca3af; margin: 5px 0;">
              Se non riesci a cliccare il pulsante, copia e incolla questo link nel browser:<br>
              <span style="word-break: break-all;">${inviteUrl}</span>
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
            <p>Non hai richiesto questo invito? Puoi ignorare questa email.</p>
            <p style="margin-top: 10px;">
              © 2026 entro - Gestisci le scadenze degli alimenti
            </p>
          </div>
        </body>
      </html>
    `

    const emailText = `
Sei stato invitato su entro!

${creatorName} ti ha invitato a condividere la sua lista di alimenti su entro.

Insieme potrete vedere gli stessi alimenti in tempo reale, aggiungere nuovi prodotti, modificare le scadenze ed evitare sprechi alimentari.

Accetta l'invito cliccando su questo link:
${inviteUrl}

Nota: Questo invito scadrà tra 7 giorni. Se non hai un account, ne creerai uno durante il processo di registrazione.

---
Non hai richiesto questo invito? Puoi ignorare questa email.
© 2026 entro - Gestisci le scadenze degli alimenti
    `

    try {
      const emailResult = await resend.emails.send({
        from: 'entro <onboarding@resend.dev>',
        to: email,
        subject: `${creatorName} ti ha invitato su entro! 🗓️`,
        html: emailHtml,
        text: emailText,
      })

      console.log('Email sent successfully:', emailResult)

      return new Response(
        JSON.stringify({
          success: true,
          invite: inviteData,
          message: `Invito inviato via email a ${email}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } catch (emailError) {
      console.error('Failed to send email:', emailError)

      // Return error but keep invite in database
      return new Response(
        JSON.stringify({
          error: 'Failed to send invite email',
          details: emailError.message,
          invite: inviteData,
          inviteUrl: inviteUrl, // Fallback: return URL for manual sharing
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
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
