import { supabase } from './supabase'
import type {
  CreateInviteResponse,
  ValidateInviteResponse,
  AcceptInviteResponse,
  AcceptInviteConfirmationResponse,
  ListResponse,
  ListMembersResponse,
} from '../types/invite.types'

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

    console.log('[registerPendingInvite] Starting registration:', {
      shortCode: shortCode.toUpperCase(),
      originalEmail: userEmail,
      normalizedEmail,
    })

    // Update invite with pending user email
    const { error } = await supabase
      .from('invites')
      .update({ pending_user_email: normalizedEmail })
      .eq('short_code', shortCode.toUpperCase())
      .eq('status', 'pending')

    if (error) {
      console.error('[registerPendingInvite] Error registering pending invite:', error)
      throw error
    }

    console.log('[registerPendingInvite] Successfully registered pending invite')

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    console.error('[registerPendingInvite] Failed:', error)
    return {
      success: false,
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

/**
 * Accepts a pending invite by the authenticated user's email
 * Used when user confirms email after signup with invite
 * Direct database implementation to bypass Edge Function JWT issues
 * @returns Response with success status and list ID
 */
export async function acceptInviteByEmail(): Promise<AcceptInviteResponse> {
  try {
    console.log('[acceptInviteByEmail] Starting invite acceptance flow')

    // Get current user
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      console.error('[acceptInviteByEmail] User not authenticated')
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id
    const userEmail = userData.user.email

    console.log('[acceptInviteByEmail] User details:', {
      userId,
      userEmail,
      emailVerified: userData.user.email_confirmed_at,
    })

    // Check if user has an email
    if (!userEmail) {
      console.warn('[acceptInviteByEmail] User has no email address')
      return {
        success: false,
        listId: null,
        error: null,
      }
    }

    // Normalize email for matching
    const normalizedEmail = userEmail.toLowerCase().trim()

    console.log('[acceptInviteByEmail] Looking for pending invite with email:', normalizedEmail)

    // Find pending invite for this email (using pending_user_email field)
    // Use ilike for case-insensitive email matching
    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .ilike('pending_user_email', normalizedEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inviteError) {
      console.error('[acceptInviteByEmail] Error querying invites:', inviteError)
      throw inviteError
    }

    if (!inviteData) {
      console.log('[acceptInviteByEmail] No pending invite found for this email')
      return {
        success: false,
        listId: null,
        error: null, // Not an error, just no invite
      }
    }

    console.log('[acceptInviteByEmail] Found pending invite:', {
      inviteId: inviteData.id,
      listId: inviteData.list_id,
      shortCode: inviteData.short_code,
      expiresAt: inviteData.expires_at,
    })

    // Check if invite has expired
    const expiresAt = new Date(inviteData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      console.warn('[acceptInviteByEmail] Invite has expired:', {
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString(),
      })

      // Update invite status to expired
      await supabase
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      return {
        success: false,
        listId: null,
        error: new Error('This invite has expired'),
      }
    }

    console.log('[acceptInviteByEmail] Invite is valid, checking existing membership')

    // Check if user is already a member of this list
    const { data: existingMember, error: memberCheckError } = await supabase
      .from('list_members')
      .select('*')
      .eq('list_id', inviteData.list_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberCheckError) {
      console.error('[acceptInviteByEmail] Error checking existing membership:', memberCheckError)
    }

    if (existingMember) {
      console.log('[acceptInviteByEmail] User is already a member, marking invite as accepted')

      // User is already a member, just mark invite as accepted
      await supabase
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id)

      return {
        success: true,
        listId: inviteData.list_id,
        error: null,
      }
    }

    console.log('[acceptInviteByEmail] Adding user to list_members')

    // Add user to list_members
    const { error: memberError } = await supabase
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (memberError) {
      console.error('[acceptInviteByEmail] Error adding member to list:', {
        error: memberError,
        code: memberError.code,
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
      })
      throw memberError
    }

    console.log('[acceptInviteByEmail] Successfully added user to list, updating invite status')

    // Update invite status to accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)

    if (updateError) {
      console.error('[acceptInviteByEmail] Error updating invite status:', updateError)
      // Don't fail if we can't update the status - the member was added successfully
    }

    console.log('[acceptInviteByEmail] Successfully accepted invite and added user to list:', inviteData.list_id)

    return {
      success: true,
      listId: inviteData.list_id,
      error: null,
    }
  } catch (error) {
    console.error('[acceptInviteByEmail] Failed to accept invite by email:', error)
    return {
      success: false,
      listId: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Gets the current user's list
 * @returns Response with list data
 */
export async function getUserList(): Promise<ListResponse> {
  try {
    console.log('[getUserList] Getting user list')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      console.error('[getUserList] User not authenticated')
      throw new Error('Not authenticated')
    }

    console.log('[getUserList] Querying list_members for user:', userData.user.id)

    // First, get the list_member record for this user
    const { data: memberData, error: memberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userData.user.id)
      .single()

    if (memberError) {
      console.error('[getUserList] Error querying list_members:', {
        code: memberError.code,
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
      })
    }

    if (memberError || !memberData) {
      console.warn('[getUserList] User is not a member of any list')
      throw new Error(memberError?.message || 'User is not a member of any list')
    }

    console.log('[getUserList] Found list membership, list_id:', memberData.list_id)

    // Then, get the list details
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', memberData.list_id)
      .single()

    if (listError) {
      console.error('[getUserList] Error querying lists:', listError)
    }

    if (listError || !listData) {
      console.error('[getUserList] List not found for id:', memberData.list_id)
      throw new Error(listError?.message || 'List not found')
    }

    console.log('[getUserList] Successfully retrieved list:', {
      listId: listData.id,
      listName: listData.name,
    })

    return {
      list: listData,
      error: null,
    }
  } catch (error) {
    console.error('[getUserList] Failed to get user list:', error)
    return {
      list: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
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
      throw new Error(error.message)
    }

    return {
      members: data || [],
      error: null,
    }
  } catch (error) {
    return {
      members: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
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
    console.log('[createPersonalList] Starting personal list creation')

    // Call the PostgreSQL function
    // This runs server-side and bypasses client-side RLS issues
    const { data, error } = await supabase
      .rpc('create_personal_list')
      .single()

    if (error) {
      console.error('[createPersonalList] Error calling create_personal_list():', error)
      throw new Error(error.message)
    }

    if (!data) {
      console.error('[createPersonalList] No data returned from create_personal_list()')
      throw new Error('No data returned from create_personal_list()')
    }

    // Type assertion for the RPC response
    const result = data as CreatePersonalListRpcResponse

    console.log('[createPersonalList] RPC result:', {
      success: result.success,
      listId: result.list_id,
      errorMessage: result.error_message,
    })

    // Check the result from the function
    if (!result.success) {
      console.error('[createPersonalList] Function returned error:', result.error_message)
      throw new Error(result.error_message || 'Failed to create personal list')
    }

    console.log('[createPersonalList] Successfully created personal list:', result.list_id)

    return {
      success: true,
      listId: result.list_id,
      error: null,
    }
  } catch (error) {
    console.error('[createPersonalList] Failed to create personal list:', error)
    return {
      success: false,
      listId: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Accepts an invite with confirmation logic for "Single List" approach
 * If user has an existing list, returns requiresConfirmation=true with food count
 * If forceAccept=true, removes user from old list and adds to new one
 * @param shortCode - The invite short code
 * @param forceAccept - If true, bypasses confirmation and accepts invite
 * @returns Response with confirmation requirement or success
 */
export async function acceptInviteWithConfirmation(
  shortCode: string,
  forceAccept: boolean = false
): Promise<AcceptInviteConfirmationResponse> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id
    const upperShortCode = shortCode.toUpperCase()

    // Step 1: Validate invite
    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('short_code', upperShortCode)
      .eq('status', 'pending')
      .maybeSingle()

    if (inviteError) {
      throw inviteError
    }

    if (!inviteData) {
      throw new Error('Invito non valido o scaduto')
    }

    // Check if invite has expired
    const expiresAt = new Date(inviteData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      // Update invite status to expired
      await supabase
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteData.id)

      throw new Error('Questo invito è scaduto')
    }

    // Step 2: Check if user already has a list
    const { data: currentMemberData, error: currentMemberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentMemberError) {
      throw currentMemberError
    }

    // Step 3: If user has no list, just add them to the new list
    if (!currentMemberData) {
      // Add user to new list
      const { error: memberError } = await supabase
        .from('list_members')
        .insert({
          list_id: inviteData.list_id,
          user_id: userId,
        })

      if (memberError) {
        throw memberError
      }

      // Update invite status to accepted
      await supabase
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id)

      return {
        success: true,
        listId: inviteData.list_id,
        requiresConfirmation: false,
        error: null,
      }
    }

    // Step 4: User has a list - check if it's the same list
    if (currentMemberData.list_id === inviteData.list_id) {
      // User is already in this list
      await supabase
        .from('invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', inviteData.id)

      return {
        success: true,
        listId: inviteData.list_id,
        requiresConfirmation: false,
        error: null,
      }
    }

    // Step 5: User has a different list - get food count
    const { count: foodCount, error: foodCountError } = await supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', currentMemberData.list_id)

    if (foodCountError) {
      throw foodCountError
    }

    // Step 6: If not forcing, return confirmation required
    if (!forceAccept) {
      return {
        success: false,
        listId: null,
        requiresConfirmation: true,
        foodCount: foodCount || 0,
        error: null,
      }
    }

    // Step 7: Force accept - remove from old list and add to new one
    const oldListId = currentMemberData.list_id

    // Remove user from old list
    const { error: removeError } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', oldListId)
      .eq('user_id', userId)

    if (removeError) {
      throw removeError
    }

    // Check if old list has any members left
    const { count: remainingMembers, error: membersCountError } = await supabase
      .from('list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', oldListId)

    if (membersCountError) {
      throw membersCountError
    }

    // If old list has no members, delete it (CASCADE will delete foods)
    if (remainingMembers === 0) {
      const { error: deleteError } = await supabase
        .from('lists')
        .delete()
        .eq('id', oldListId)

      if (deleteError) {
        console.error('Error deleting old list:', deleteError)
        // Don't fail the whole operation if delete fails
      }
    }

    // Add user to new list
    const { error: newMemberError } = await supabase
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (newMemberError) {
      throw newMemberError
    }

    // Update invite status to accepted
    await supabase
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)

    return {
      success: true,
      listId: inviteData.list_id,
      requiresConfirmation: false,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      listId: null,
      requiresConfirmation: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Leaves the current shared list and creates a new personal list
 * Only works if current list is shared (>1 member)
 * @returns Response with success status
 */
export async function leaveSharedList(): Promise<{ success: boolean; error: Error | null }> {
  try {
    console.log('[leaveSharedList] Starting leave list flow')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      console.error('[leaveSharedList] User not authenticated')
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id
    console.log('[leaveSharedList] User ID:', userId)

    // Step 1: Get user's current list
    const { data: currentMemberData, error: currentMemberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentMemberError) {
      console.error('[leaveSharedList] Error getting current list:', currentMemberError)
      throw currentMemberError
    }

    if (!currentMemberData) {
      console.warn('[leaveSharedList] User is not a member of any list')
      throw new Error('Non sei membro di alcuna lista')
    }

    const currentListId = currentMemberData.list_id
    console.log('[leaveSharedList] Current list ID:', currentListId)

    // Step 2: Check if list is shared (>1 member)
    const { count: memberCount, error: memberCountError } = await supabase
      .from('list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', currentListId)

    if (memberCountError) {
      console.error('[leaveSharedList] Error counting members:', memberCountError)
      throw memberCountError
    }

    console.log('[leaveSharedList] Member count:', memberCount)

    if (memberCount === null || memberCount <= 1) {
      console.warn('[leaveSharedList] Cannot leave personal list')
      throw new Error('Non puoi abbandonare una lista personale')
    }

    // Step 3: Remove user from current list
    console.log('[leaveSharedList] Removing user from list:', currentListId)
    const { error: removeError } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', currentListId)
      .eq('user_id', userId)

    if (removeError) {
      console.error('[leaveSharedList] Error removing user from list:', {
        error: removeError,
        code: removeError.code,
        message: removeError.message,
        details: removeError.details,
      })
      throw removeError
    }

    console.log('[leaveSharedList] Successfully removed user from list')

    // Step 4: Create new personal list
    console.log('[leaveSharedList] Creating new personal list')
    const createResult = await createPersonalList()
    if (!createResult.success) {
      console.error('[leaveSharedList] Failed to create personal list:', createResult.error)
      throw createResult.error || new Error('Failed to create personal list')
    }

    console.log('[leaveSharedList] Successfully created new personal list:', createResult.listId)

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    console.error('[leaveSharedList] Leave list flow failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
