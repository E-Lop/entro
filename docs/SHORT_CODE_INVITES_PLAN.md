# Piano: Sistema Codice Breve per Inviti Lista Condivisa

**Data Piano**: 21 Gennaio 2026
**Status**: Pronto per Implementazione
**Stima Effort**: 5-6 ore sviluppo

---

## Problema da Risolvere

1. **Toast su Mobile**: Link lungo (80+ caratteri) in toast non copiabile facilmente
2. **Token lungo**: 32 caratteri alfanumerici difficile da condividere manualmente
3. **UX Mobile**: Necessità di metodo facile per condividere inviti via WhatsApp/SMS/Telegram

## Soluzione: Codice Breve Anonimo

Sistema tipo Discord/Zoom/Airbnb con codice alfanumerico **completamente anonimo**:
- ✅ Facile da copiare e condividere su mobile
- ✅ Supporta Web Share API per condivisione nativa
- ✅ Nessuna dipendenza email esterna
- ✅ Zero costi ricorrenti
- ✅ UX moderna e familiare
- ✅ **Ultra-semplificato: nessun campo email necessario**

**Formato:** 6 caratteri maiuscoli alfanumerici (es: `ABC123`, `X7K9P2`)
**URL breve:** `https://entro-il.netlify.app/join/ABC123`

---

## Decisioni Architetturali

### Approccio Ultra-Semplificato

**Eliminazioni:**
- ❌ Token lungo (mai usato se non in test)
- ❌ Campo email (non più necessario senza invio email)
- ❌ Email prefill/lock in signup
- ❌ Associazione email-codice

**Risultato:**
- Codice è **completamente anonimo** e condivisibile con chiunque
- Chi ha il codice può registrarsi e unirsi alla lista
- Nessun vincolo su chi può usare il codice
- Massima semplicità e flessibilità

**Security considerations:**
- Codice scade in 7 giorni (mitiga intercettazioni)
- App per liste della spesa familiari (non dati sensibili)
- UX > security per questo use case
- Entropy: 36^6 = 2.1 miliardi combinazioni (sufficiente)

---

## Architettura Tecnica

### 1. Database Migration

**File:** `migrations/010_simplify_invites_short_code.sql`

```sql
-- Add short_code as primary identifier
ALTER TABLE invites ADD COLUMN short_code VARCHAR(8) NOT NULL;

-- Create unique index for fast lookup
CREATE UNIQUE INDEX idx_invites_short_code ON invites(short_code);

-- Remove email requirement (make nullable for safety)
ALTER TABLE invites ALTER COLUMN email DROP NOT NULL;

-- Note: Manteniamo campo token per audit/logging ma mai esposto
-- Note: Manteniamo campo email nullable per eventuali usi futuri
```

**Rationale:**
- `short_code` è l'unico identificatore usato nelle API
- `email` rimane nullable per backwards compatibility DB
- `token` rimane per audit interno
- Indice unico su short_code per performance

---

### 2. Backend - Edge Functions

#### 2.1 create-invite/index.ts

**ULTRA-SEMPLIFICATO:**

```typescript
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
    const { data: inviteData, error: inviteError } = await supabaseClient
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
```

---

#### 2.2 validate-invite/index.ts

**SEMPLIFICATO - No email check:**

```typescript
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
```

---

#### 2.3 accept-invite/index.ts

**SEMPLIFICATO - No email match check:**

```typescript
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
```

---

### 3. Frontend - Service Layer

**File:** `src/lib/invites.ts`

**ULTRA-SEMPLIFICATO:**

```typescript
/**
 * Creates an invite and returns short code
 * No email needed!
 */
export async function createInvite(
  listId: string
): Promise<CreateInviteResponse> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ listId }),  // SOLO listId
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create invite')
    }

    return {
      success: true,
      shortCode: data.shortCode,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      shortCode: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Validates an invite by short code
 */
export async function validateInvite(
  shortCode: string
): Promise<ValidateInviteResponse> {
  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/validate-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ shortCode: shortCode.toUpperCase() }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to validate invite')
    }

    return {
      valid: data.valid,
      invite: data.invite,
      error: null,
    }
  } catch (error) {
    return {
      valid: false,
      invite: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Accepts an invite by short code
 */
export async function acceptInvite(shortCode: string): Promise<AcceptInviteResponse> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ shortCode: shortCode.toUpperCase() }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept invite')
    }

    return {
      success: data.success,
      listId: data.listId,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      listId: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
```

---

### 4. Frontend - Types

**File:** `src/types/invite.types.ts`

**SEMPLIFICATO:**

```typescript
export interface CreateInviteResponse {
  success: boolean
  shortCode: string | null
  error: Error | null
}

export interface ValidateInviteResponse {
  valid: boolean
  invite: {
    listName: string
    creatorName: string
    expiresAt: string
    // NO email field
  } | null
  error: Error | null
}

export interface AcceptInviteResponse {
  success: boolean
  listId: string | null
  error: Error | null
}
```

---

### 5. Frontend - InviteDialog Component

**File:** `src/components/sharing/InviteDialog.tsx`

**ULTRA-SEMPLIFICATO - NO FORM EMAIL:**

```tsx
import { useState } from 'react'
import { Copy, Share2, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { createInvite, getUserList } from '../../lib/invites'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateInvite = async () => {
    setIsLoading(true)

    try {
      const { list, error: listError } = await getUserList()
      if (listError || !list) {
        toast.error('Non hai una lista da condividere')
        return
      }

      // NO email needed!
      const result = await createInvite(list.id)

      if (result.error || !result.success || !result.shortCode) {
        toast.error(result.error?.message || 'Impossibile creare l\'invito')
        return
      }

      // Success - mostra codice
      setInviteCode(result.shortCode)

    } catch (error) {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!inviteCode) return

    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      toast.success('Codice copiato!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossibile copiare il codice')
    }
  }

  const handleShare = async () => {
    if (!inviteCode) return

    const shareData = {
      title: 'Invito entro',
      text: `Unisciti alla mia lista su entro! Usa il codice: ${inviteCode}`,
      url: `${window.location.origin}/join/${inviteCode}`
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled, ignore
      }
    } else {
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(shareData.url)
        toast.success('Link copiato!')
      } catch {
        toast.error('Impossibile condividere')
      }
    }
  }

  const handleClose = () => {
    setInviteCode(null)
    setCopied(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        {!inviteCode ? (
          // Schermata iniziale - NESSUN FORM
          <>
            <DialogHeader>
              <DialogTitle>Invita membro</DialogTitle>
              <DialogDescription>
                Crea un codice invito da condividere con chi vuoi.
                Il codice può essere usato da chiunque per unirsi alla tua lista.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <Button
                onClick={handleCreateInvite}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creazione codice...
                  </>
                ) : (
                  'Genera codice invito'
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="w-full"
              >
                Annulla
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Mostra codice dopo creazione
          <>
            <DialogHeader>
              <DialogTitle>Invito creato!</DialogTitle>
              <DialogDescription>
                Condividi questo codice con chi vuoi invitare
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {/* Codice grande e visibile */}
              <div className="bg-primary/10 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Codice invito
                </p>
                <p className="text-4xl font-bold tracking-wider font-mono">
                  {inviteCode}
                </p>
              </div>

              {/* Bottoni azione */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleCopyCode}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copia
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleShare}
                  className="w-full"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Condividi
                </Button>
              </div>

              {/* Istruzioni */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Condividi questo codice via WhatsApp, Telegram, SMS o qualsiasi app.
                  Il destinatario potrà usarlo durante la registrazione o visitare:
                </p>
                <p className="text-sm font-mono mt-2 break-all">
                  {window.location.origin}/join/{inviteCode}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Chiudi
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

---

### 6. Frontend - SignUpPage

**File:** `src/pages/SignUpPage.tsx`

**SEMPLIFICATO - No email prefill:**

```tsx
export function SignUpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, loading } = useAuth()

  // Solo short code
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteValid, setInviteValid] = useState<boolean>(false)
  const [inviteLoading, setInviteLoading] = useState<boolean>(false)
  const [inviteCreatorName, setInviteCreatorName] = useState<string>('')

  // Input manuale
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')

    if (code) {
      setInviteCode(code.toUpperCase())
      setInviteLoading(true)
      validateInvite(code)
        .then(({ valid, invite, error }) => {
          if (valid && invite) {
            setInviteValid(true)
            setInviteCreatorName(invite.creatorName || 'un utente')
            // NO email prefill
          } else {
            toast.error(error?.message || 'Codice non valido')
          }
        })
        .finally(() => setInviteLoading(false))
    }
  }, [searchParams])

  const handleManualCodeSubmit = async () => {
    if (!manualCode || manualCode.length !== 6) {
      toast.error('Inserisci un codice valido (6 caratteri)')
      return
    }

    setInviteLoading(true)
    const { valid, invite, error } = await validateInvite(manualCode)

    if (valid && invite) {
      setInviteCode(manualCode.toUpperCase())
      setInviteValid(true)
      setInviteCreatorName(invite.creatorName || 'un utente')
      setShowCodeInput(false)
    } else {
      toast.error(error?.message || 'Codice non valido')
    }
    setInviteLoading(false)
  }

  const handleSuccess = async () => {
    try {
      if (inviteCode && inviteValid) {
        // Call acceptInvite con short code
        const { success, error } = await acceptInvite(inviteCode)

        if (!success) {
          console.error('Failed to accept invite:', error)
        }

        toast.info(
          'Registrazione completata! Controlla la tua email e clicca sul link di conferma per unirti alla lista condivisa.',
          { duration: 12000 }
        )
      } else {
        // Signup senza invito - crea lista personale
        const { createPersonalList } = await import('../lib/invites')
        const { success, error } = await createPersonalList()

        if (!success) {
          console.error('Failed to create personal list:', error)
        }

        toast.success(
          'Registrazione completata! Controlla la tua email per confermare l\'account.',
          { duration: 10000 }
        )
      }
    } catch (error) {
      console.error('Post-signup error:', error)
    }
  }

  // ... resto UI con input manuale codice
  // NO email prefill, NO email lock

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Crea il tuo account
          </CardTitle>
          <CardDescription className="text-center">
            {inviteLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifica invito...
              </span>
            ) : inviteValid ? (
              <span className="text-primary font-medium">
                {inviteCreatorName} ti ha invitato a condividere la sua lista!
              </span>
            ) : (
              'Inizia a tracciare le scadenze dei tuoi alimenti'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Input codice manuale */}
          {!inviteValid && !inviteCode && (
            <div className="mb-4">
              {!showCodeInput ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCodeInput(true)}
                >
                  Ho un codice invito
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label>Codice invito</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="ABC123"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono text-lg tracking-wider"
                    />
                    <Button onClick={handleManualCodeSubmit}>
                      Verifica
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCodeInput(false)}
                  >
                    Annulla
                  </Button>
                </div>
              )}
            </div>
          )}

          <AuthForm
            mode="signup"
            onSuccess={handleSuccess}
            // NO prefillEmail, NO lockEmail
          />
        </CardContent>

        {/* ... footer esistente */}
      </Card>
    </div>
  )
}
```

---

### 7. Frontend - Route /join/:code

**File:** `src/App.tsx`

**Invariato:**

```tsx
import { useParams, Navigate } from 'react-router-dom'

function JoinPage() {
  const { code } = useParams<{ code: string }>()

  if (!code) {
    return <Navigate to="/signup" replace />
  }

  return <Navigate to={`/signup?code=${code.toUpperCase()}`} replace />
}

// In <Routes>
<Route path="/join/:code" element={<JoinPage />} />
```

---

## Testing Plan

### Functional Tests

```
✓ Crea invito (no email) → Genera short_code
✓ Copia codice → Clipboard
✓ Condividi codice → Web Share API
✓ Valida codice valido → Success
✓ Valida codice scaduto → Error
✓ Valida codice inesistente → Error
✓ Accetta invito (qualsiasi user) → Aggiunto a lista
✓ Route /join/ABC123 → Signup
✓ Input manuale codice → Valida
✓ NO email match check → Chiunque può usare codice
```

### Mobile Testing

```
iOS Safari:
  ✓ Web Share API → WhatsApp, Messages, Mail
  ✓ Copia codice

Android Chrome:
  ✓ Web Share API → WhatsApp, Telegram, SMS
  ✓ Copia codice
```

---

## Deployment Steps

### 1. Database Migration
```bash
cd /Users/edmondo/Documents/entro
npx supabase migration new simplify_invites_short_code
# Copia SQL dal piano
npx supabase db push
```

### 2. Rigenera Types
```bash
npx supabase gen types typescript --local > src/lib/supabase.types.ts
```

### 3. Deploy Edge Functions
```bash
npx supabase functions deploy create-invite
npx supabase functions deploy validate-invite
npx supabase functions deploy accept-invite
```

### 4. Build & Deploy Frontend
```bash
npm run build
git add .
git commit -m "feat: implement anonymous short invite codes for mobile sharing"
git push origin main
```

---

## File Summary

### Nuovi File
1. `migrations/010_simplify_invites_short_code.sql`
2. `src/components/sharing/InviteDialog.tsx`
3. `src/types/invite.types.ts`

### File Modificati
1. `supabase/functions/create-invite/index.ts` - No email
2. `supabase/functions/validate-invite/index.ts` - No email check
3. `supabase/functions/accept-invite/index.ts` - No email match
4. `src/lib/invites.ts` - No email param
5. `src/pages/SignUpPage.tsx` - No email prefill
6. `src/App.tsx` - Route /join/:code

### File da Rigenerare
1. `src/lib/supabase.types.ts`

---

## Effort Estimate

- **Database Migration:** 10 min (semplificato)
- **Edge Functions:** 1.5 ore (più semplice senza email)
- **Frontend InviteDialog:** 1 ora (no form!)
- **SignUpPage:** 30 min (rimuovi email logic)
- **Testing:** 1.5 ore
- **Deploy + Verification:** 30 min

**Totale stimato:** 5-6 ore sviluppo

---

## Note Implementative

### Differenze da SHARED_LISTS_PLAN.md

Questo piano SOSTITUISCE parzialmente l'approccio email-based documentato in `SHARED_LISTS_PLAN.md`:

**Manteniamo:**
- ✅ Database schema (lists, list_members, invites)
- ✅ RLS policies
- ✅ Edge functions structure (create/validate/accept)
- ✅ Frontend service layer pattern

**Cambiamo:**
- ❌ Rimuoviamo email requirement
- ❌ Rimuoviamo token lungo (sostituito da short_code)
- ❌ Rimuoviamo email prefill in signup
- ✅ Aggiungiamo short_code (6 caratteri)
- ✅ Aggiungiamo Web Share API
- ✅ Aggiungiamo route /join/:code

**Razionale:**
Il sistema email-based funziona ma ha UX problemi su mobile:
- Link lunghi non copiabili facilmente da toast
- Token 32 caratteri difficile da condividere manualmente
- Dipendenza da Resend per invio email

Il sistema short code risolve tutti questi problemi mantenendo la stessa architettura backend/frontend.

---

*Piano ultra-semplificato pronto per implementazione nella prossima sessione*
