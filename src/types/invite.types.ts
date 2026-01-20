import type { Database } from '../lib/supabase'

// Type aliases from Database types
export type List = Database['public']['Tables']['lists']['Row']
export type ListInsert = Database['public']['Tables']['lists']['Insert']
export type ListUpdate = Database['public']['Tables']['lists']['Update']

export type ListMember = Database['public']['Tables']['list_members']['Row']
export type ListMemberInsert = Database['public']['Tables']['list_members']['Insert']

export type Invite = Database['public']['Tables']['invites']['Row']
export type InviteInsert = Database['public']['Tables']['invites']['Insert']
export type InviteUpdate = Database['public']['Tables']['invites']['Update']

// Response types for service layer
export interface InviteResponse {
  invite: Invite | null
  error: Error | null
}

export interface InvitesResponse {
  invites: Invite[]
  error: Error | null
}

export interface ListResponse {
  list: List | null
  error: Error | null
}

export interface ListMembersResponse {
  members: ListMember[]
  error: Error | null
}

export interface CreateInviteResponse {
  success: boolean
  invite: Invite | null
  error: Error | null
}

export interface ValidateInviteResponse {
  valid: boolean
  invite: {
    email: string
    listName: string
    creatorName: string
    expiresAt: string
  } | null
  error: Error | null
}

export interface AcceptInviteResponse {
  success: boolean
  listId: string | null
  error: Error | null
}
