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
    // Update invite with pending user email
    const { error } = await supabase
      .from('invites')
      .update({ pending_user_email: userEmail })
      .eq('short_code', shortCode.toUpperCase())
      .eq('status', 'pending')

    if (error) {
      console.error('Error registering pending invite:', error)
      throw error
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
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
    // Get current user
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id
    const userEmail = userData.user.email

    // Find pending invite for this email (using pending_user_email field)
    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('pending_user_email', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inviteError) {
      console.error('Error querying invites:', inviteError)
      throw inviteError
    }

    if (!inviteData) {
      return {
        success: false,
        listId: null,
        error: null, // Not an error, just no invite
      }
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

      return {
        success: false,
        listId: null,
        error: new Error('This invite has expired'),
      }
    }

    // Check if user is already a member of this list
    const { data: existingMember } = await supabase
      .from('list_members')
      .select('*')
      .eq('list_id', inviteData.list_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember) {
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

    // Add user to list_members
    const { error: memberError } = await supabase
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (memberError) {
      console.error('Error adding member to list:', memberError)
      throw memberError
    }

    // Update invite status to accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteData.id)

    if (updateError) {
      console.error('Error updating invite status:', updateError)
      // Don't fail if we can't update the status - the member was added successfully
    }

    return {
      success: true,
      listId: inviteData.list_id,
      error: null,
    }
  } catch (error) {
    console.error('Failed to accept invite by email:', error)
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
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Not authenticated')
    }

    // First, get the list_member record for this user
    const { data: memberData, error: memberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userData.user.id)
      .single()

    if (memberError || !memberData) {
      throw new Error(memberError?.message || 'User is not a member of any list')
    }

    // Then, get the list details
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('*')
      .eq('id', memberData.list_id)
      .single()

    if (listError || !listData) {
      throw new Error(listError?.message || 'List not found')
    }

    return {
      list: listData,
      error: null,
    }
  } catch (error) {
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
 * Creates a personal list for a new user (called after signup)
 * @returns Response with success status
 */
export async function createPersonalList(): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Not authenticated')
    }

    // Create new list
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .insert({
        name: 'La mia lista',
        created_by: userData.user.id,
      })
      .select()
      .single()

    if (listError || !listData) {
      throw new Error(listError?.message || 'Failed to create list')
    }

    // Add user as member
    const { error: memberError } = await supabase
      .from('list_members')
      .insert({
        list_id: listData.id,
        user_id: userData.user.id,
      })

    if (memberError) {
      throw new Error(memberError.message)
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
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
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id

    // Step 1: Get user's current list
    const { data: currentMemberData, error: currentMemberError } = await supabase
      .from('list_members')
      .select('list_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (currentMemberError) {
      throw currentMemberError
    }

    if (!currentMemberData) {
      throw new Error('Non sei membro di alcuna lista')
    }

    const currentListId = currentMemberData.list_id

    // Step 2: Check if list is shared (>1 member)
    const { count: memberCount, error: memberCountError } = await supabase
      .from('list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', currentListId)

    if (memberCountError) {
      throw memberCountError
    }

    if (memberCount === null || memberCount <= 1) {
      throw new Error('Non puoi abbandonare una lista personale')
    }

    // Step 3: Remove user from current list
    const { error: removeError } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', currentListId)
      .eq('user_id', userId)

    if (removeError) {
      throw removeError
    }

    // Step 4: Create new personal list
    const createResult = await createPersonalList()
    if (!createResult.success) {
      throw createResult.error || new Error('Failed to create personal list')
    }

    return {
      success: true,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
