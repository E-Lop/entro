import { supabase } from './supabase'
import type {
  CreateInviteResponse,
  ValidateInviteResponse,
  AcceptInviteResponse,
  ListResponse,
  ListMembersResponse,
} from '../types/invite.types'

/**
 * Invites Service Layer - Functions to manage shared lists and invitations
 */

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

/**
 * Creates an invite and sends email to the recipient
 * @param email - Email address to send invite to
 * @param listId - ID of the list to invite user to
 * @returns Response with success status and invite data
 */
export async function createInvite(
  email: string,
  listId: string
): Promise<CreateInviteResponse> {
  try {
    // Get current session for auth token
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('Not authenticated')
    }

    // Call Edge Function
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ email, listId }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create invite')
    }

    return {
      success: data.success,
      invite: data.invite,
      error: null,
    }
  } catch (error) {
    return {
      success: false,
      invite: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}

/**
 * Validates an invite token (public, no auth required)
 * @param token - Invite token to validate
 * @returns Response with validation status and invite details
 */
export async function validateInvite(
  token: string
): Promise<ValidateInviteResponse> {
  try {
    // Call Edge Function (public endpoint)
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/validate-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
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
 * Accepts an invite and adds user to the shared list
 * @param token - Invite token to accept
 * @returns Response with success status and list ID
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResponse> {
  try {
    // Get current session for auth token
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      throw new Error('Not authenticated')
    }

    // Call Edge Function
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/accept-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ token }),
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
      console.log('acceptInviteByEmail: No user found')
      throw new Error('Not authenticated')
    }

    const userId = userData.user.id
    const userEmail = userData.user.email

    console.log('acceptInviteByEmail: Looking for pending invite for:', userEmail)

    // Find pending invite for this email (using public read access from RLS)
    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('email', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (inviteError) {
      console.error('acceptInviteByEmail: Error querying invites:', inviteError)
      throw inviteError
    }

    if (!inviteData) {
      console.log('acceptInviteByEmail: No pending invite found')
      return {
        success: false,
        listId: null,
        error: null, // Not an error, just no invite
      }
    }

    console.log('acceptInviteByEmail: Found invite:', inviteData.id, 'for list:', inviteData.list_id)

    // Check if invite has expired
    const expiresAt = new Date(inviteData.expires_at)
    const now = new Date()

    if (expiresAt < now) {
      console.log('acceptInviteByEmail: Invite has expired')
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
      console.log('acceptInviteByEmail: User is already a member')
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
    console.log('acceptInviteByEmail: Adding user to list_members')
    const { error: memberError } = await supabase
      .from('list_members')
      .insert({
        list_id: inviteData.list_id,
        user_id: userId,
      })

    if (memberError) {
      console.error('acceptInviteByEmail: Error adding member:', memberError)
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
      console.error('acceptInviteByEmail: Error updating invite status:', updateError)
      // Don't fail if we can't update the status - the member was added successfully
    }

    console.log('acceptInviteByEmail: Successfully accepted invite for list:', inviteData.list_id)
    return {
      success: true,
      listId: inviteData.list_id,
      error: null,
    }
  } catch (error) {
    console.error('acceptInviteByEmail: Exception caught:', error)
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
