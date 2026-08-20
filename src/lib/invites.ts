import { supabase } from './supabase'
import { logError } from './safeLog'
import type {
  CreateInviteResponse,
  ValidateInviteResponse,
  AcceptInviteResponse,
  AcceptInviteConfirmationResponse,
  ListResponse,
  ListMembersResponse,
} from '../types/invite.types'
import { userFacingError } from './userFacingError'

/**
 * Invites Service Layer - Functions to manage shared lists and invitations
 */

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

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
      throw new Error('Sessione scaduta. Accedi di nuovo.')
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
      throw userFacingError('Non è stato possibile creare l\'invito. Riprova.', data.error)
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
      error: error instanceof Error ? error : new Error('Non è stato possibile creare l\'invito. Riprova.'),
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
      throw userFacingError('Non è stato possibile verificare il codice. Riprova.', data.error)
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
      error: error instanceof Error ? error : new Error('Non è stato possibile verificare il codice. Riprova.'),
    }
  }
}

/**
 * Registers user email with an invite during signup (before email confirmation)
 * Saves the user's email to the invite so it can be accepted after login
 */
export async function registerPendingInvite(
  shortCode: string,
  userEmail: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // Normalize email to lowercase for consistent matching
    const normalizedEmail = userEmail.toLowerCase().trim()

    // Runs during signup as the anon role: go through a SECURITY DEFINER RPC so
    // anon needs no direct grant/RLS access to the invites table (issue #67).
    const { error } = await supabase.rpc('register_pending_invite', {
      p_short_code: shortCode.toUpperCase(),
      p_email: normalizedEmail,
    })

    if (error) {
      // Il messaggio del server non viene stampato: `register_pending_invite`
      // riceve il codice invito fra i parametri, quindi un `RAISE EXCEPTION`
      // che lo interpola lo farebbe finire in console. Qui il segreto è il
      // messaggio stesso, e redigerlo non basterebbe.
      console.error('[registerPendingInvite] Error registering pending invite')
      throw error
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    console.error('[registerPendingInvite] Failed')
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Non è stato possibile registrare l\'invito. Riprova.'),
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
      throw new Error('Sessione scaduta. Accedi di nuovo.')
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
      throw userFacingError('Non è stato possibile accettare l\'invito. Riprova.', data.error)
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
      error: error instanceof Error ? error : new Error('Non è stato possibile accettare l\'invito. Riprova.'),
    }
  }
}

/**
 * Accepts a pending invite by the authenticated user's email
 * Used when user confirms email after signup with invite
 * Runs server-side via SECURITY DEFINER RPC (issue #70/#71) so the client
 * needs no direct table access to `invites`/`list_members`.
 * @returns Response with success status and list ID
 */
export async function acceptInviteByEmail(): Promise<AcceptInviteResponse> {
  try {
    const { data, error } = await supabase.rpc('accept_pending_invite_by_email')
    if (error) {
      logError('[acceptInviteByEmail] RPC error:', error)
      return { success: false, listId: null, error: userFacingError('Non è stato possibile accettare l\'invito. Riprova.', error) }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row || !row.success) {
      return { success: false, listId: null, error: row?.error_message ? new Error(row.error_message) : null }
    }
    return { success: true, listId: row.list_id, error: null }
  } catch (error) {
    return { success: false, listId: null, error: error instanceof Error ? error : new Error('Non è stato possibile accettare l\'invito. Riprova.') }
  }
}

/**
 * Gets the current user's list
 * @returns Response with list data
 */
export async function getUserList(): Promise<ListResponse> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      console.error('[getUserList] User not authenticated')
      throw new Error('Sessione scaduta. Accedi di nuovo.')
    }

    // First, get the list_member record for this user
    const { data: memberData, error: memberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (memberError) {
      logError('[getUserList] Error querying list_members:', memberError)
    }

    if (memberError || !memberData) {
      console.warn('[getUserList] User is not a member of any list')
      throw userFacingError('Non è stato possibile caricare la tua lista. Riprova.', memberError)
    }

    // Then, get the list details
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', memberData.list_id)
      .maybeSingle()

    if (listError) {
      logError('[getUserList] Error querying lists:', listError)
    }

    if (listError || !listData) {
      console.error(`[getUserList] List not found for id: ${memberData.list_id}`)
      throw userFacingError('Non è stato possibile caricare la tua lista. Riprova.', listError)
    }

    return {
      list: listData,
      error: null,
    }
  } catch (error) {
    logError('[getUserList] Failed to get user list:', error)
    return {
      list: null,
      error: error instanceof Error ? error : new Error('Non è stato possibile caricare la tua lista. Riprova.'),
    }
  }
}

/**
 * Gets all members of a list
 * @param listId - ID of the list
 * @returns Response with array of list members
 */
export async function getListMembers(
  listId: string
): Promise<ListMembersResponse> {
  try {
    const { data, error } = await supabase
      .from('list_members')
      .select('*')
      .eq('list_id', listId)

    if (error) {
      throw userFacingError('Non è stato possibile caricare i membri della lista. Riprova.', error)
    }

    return {
      members: data || [],
      error: null,
    }
  } catch (error) {
    return {
      members: [],
      error: error instanceof Error ? error : new Error('Non è stato possibile caricare i membri della lista. Riprova.'),
    }
  }
}

/**
 * RPC response type for create_personal_list function
 */
interface CreatePersonalListRpcResponse {
  list_id: string | null
  success: boolean
  error_message: string | null
}

/**
 * Creates a personal list for a new user (called after signup)
 * Uses PostgreSQL function to avoid race conditions with session initialization
 * The function runs server-side and has reliable access to auth.uid()
 * @returns Response with success status and list ID
 */
export async function createPersonalList(): Promise<{
  success: boolean
  listId?: string | null
  error: Error | null
}> {
  try {
    // Call the PostgreSQL function
    // This runs server-side and bypasses client-side RLS issues
    const { data, error } = await supabase
      .rpc('create_personal_list')
      .single()

    if (error) {
      logError('[createPersonalList] Error calling create_personal_list():', error)
      throw userFacingError('Non è stato possibile creare la tua lista. Riprova.', error)
    }

    if (!data) {
      console.error('[createPersonalList] No data returned from create_personal_list()')
      throw userFacingError('Non è stato possibile creare la tua lista. Riprova.', 'create_personal_list() non ha restituito dati')
    }

    // Type assertion for the RPC response
    const result = data as CreatePersonalListRpcResponse

    // Check the result from the function
    if (!result.success) {
      logError('[createPersonalList] Function returned error:', result.error_message)
      throw userFacingError('Non è stato possibile creare la tua lista. Riprova.', result.error_message)
    }

    return {
      success: true,
      listId: result.list_id,
      error: null,
    }
  } catch (error) {
    logError('[createPersonalList] Failed to create personal list:', error)
    return {
      success: false,
      listId: null,
      error: error instanceof Error ? error : new Error('Non è stato possibile creare la tua lista. Riprova.'),
    }
  }
}

/**
 * Accepts an invite with confirmation logic for "Single List" approach
 * If user has an existing list, returns requiresConfirmation=true with food count
 * If forceAccept=true, removes user from old list and adds to new one
 * Runs server-side via SECURITY DEFINER RPC (issue #70/#71) so the client
 * needs no direct table access to `invites`/`list_members`/`lists`/`foods`.
 * @param shortCode - The invite short code
 * @param forceAccept - If true, bypasses confirmation and accepts invite
 * @returns Response with confirmation requirement or success
 */
export async function acceptInviteWithConfirmation(
  shortCode: string,
  forceAccept: boolean = false
): Promise<AcceptInviteConfirmationResponse> {
  try {
    const { data, error } = await supabase.rpc('join_list_via_invite', {
      p_short_code: shortCode.toUpperCase(),
      p_force: forceAccept,
    })
    if (error) {
      return { success: false, listId: null, requiresConfirmation: false, error: userFacingError('Non è stato possibile accettare l\'invito. Riprova.', error) }
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      return { success: false, listId: null, requiresConfirmation: false, error: new Error('Nessuna risposta') }
    }
    if (row.requires_confirmation) {
      return { success: false, listId: null, requiresConfirmation: true, foodCount: row.food_count ?? 0, error: null }
    }
    if (!row.success) {
      return { success: false, listId: null, requiresConfirmation: false, error: row.error_message ? new Error(row.error_message) : new Error('Accettazione non riuscita') }
    }
    return { success: true, listId: row.list_id, requiresConfirmation: false, error: null }
  } catch (error) {
    return { success: false, listId: null, requiresConfirmation: false, error: error instanceof Error ? error : new Error('Non è stato possibile accettare l\'invito. Riprova.') }
  }
}

/**
 * Leaves the current shared list and creates a new personal list
 * Only works if current list is shared (>1 member)
 * @returns Response with success status
 */
export async function leaveSharedList(): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      console.error('[leaveSharedList] User not authenticated')
      throw new Error('Sessione scaduta. Accedi di nuovo.')
    }

    const userId = userData.user.id

    // Step 1: Get user's current list
    const { data: currentMemberData, error: currentMemberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentMemberError) {
      logError('[leaveSharedList] Error getting current list:', currentMemberError)
      throw userFacingError('Non è stato possibile abbandonare la lista. Riprova.', currentMemberError)
    }

    if (!currentMemberData) {
      console.warn('[leaveSharedList] User is not a member of any list')
      throw new Error('Non sei membro di alcuna lista')
    }

    const currentListId = currentMemberData.list_id

    // Step 2: Check if list is shared (>1 member)
    const { count: memberCount, error: memberCountError } = await supabase
      .from('list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', currentListId)

    if (memberCountError) {
      logError('[leaveSharedList] Error counting members:', memberCountError)
      throw userFacingError('Non è stato possibile abbandonare la lista. Riprova.', memberCountError)
    }

    if (memberCount === null || memberCount <= 1) {
      console.warn('[leaveSharedList] Cannot leave personal list')
      throw new Error('Non puoi abbandonare una lista personale')
    }

    // Step 3: Remove user from current list
    const { error: removeError } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', currentListId)
      .eq('user_id', userId)

    if (removeError) {
      logError('[leaveSharedList] Error removing user from list:', removeError)
      throw userFacingError('Non è stato possibile abbandonare la lista. Riprova.', removeError)
    }

    // Step 4: Create new personal list
    const createResult = await createPersonalList()
    if (!createResult.success) {
      logError('[leaveSharedList] Failed to create personal list:', createResult.error)
      throw createResult.error || userFacingError('Non è stato possibile abbandonare la lista. Riprova.', null)
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    logError('[leaveSharedList] Leave list flow failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Non è stato possibile abbandonare la lista. Riprova.'),
    }
  }
}
