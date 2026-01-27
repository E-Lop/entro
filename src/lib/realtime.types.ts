/**
 * TypeScript types for Supabase Realtime payloads
 */

import type { Food } from '../types/food.types';
import type { ListMember } from '../types/invite.types';

// Supabase Realtime event types
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

// Generic Realtime payload structure from Supabase
export interface RealtimePayload<T> {
  eventType: RealtimeEventType;
  new: T;
  old: Partial<T>;
  errors: string[] | null;
  schema: string;
  table: string;
  commit_timestamp: string;
}

// Specific payload types for each table
export type FoodRealtimePayload = RealtimePayload<Food>;
export type ListMemberRealtimePayload = RealtimePayload<ListMember>;

// Client-side extended types with realtime metadata
export interface FoodWithRealtimeMetadata extends Food {
  isRemoteUpdate?: boolean;
  remoteUpdateTimestamp?: number;
}

// Mutation tracking for deduplication
export interface MutationRecord {
  id: string;
  timestamp: number;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
}

// Channel status
export type ChannelStatus =
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

// System message payload for connection monitoring
export interface SystemMessage {
  channel: string;
  extension: string;
  message: string;
  status: ChannelStatus;
}
