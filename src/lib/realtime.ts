/**
 * Event handlers for Supabase Realtime
 * - Handles INSERT/UPDATE/DELETE events
 * - Updates React Query cache immutably
 * - Integrates with deduplication logic
 */

import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  FoodRealtimePayload,
  ListMemberRealtimePayload,
} from './realtime.types';
import { foodsKeys } from '../hooks/useFoods';
import { RecentMutationsTracker } from '../utils/realtimeHelpers';

// Shared mutation tracker instance
export const mutationTracker = new RecentMutationsTracker();

/**
 * Handle realtime INSERT event for foods
 */
export function handleFoodInsert(
  _payload: FoodRealtimePayload,
  queryClient: QueryClient,
): void {
  // Force refetch to ensure UI updates
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
}

/**
 * Handle realtime UPDATE event for foods
 */
export function handleFoodUpdate(
  payload: FoodRealtimePayload,
  queryClient: QueryClient,
): void {
  const updatedFood = payload.new;

  // Skip if this was a recent local mutation (deduplication)
  if (mutationTracker.wasRecentlyMutated(updatedFood.id, 'UPDATE')) {
    return;
  }

  // Force refetch to ensure UI updates
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
  queryClient.invalidateQueries({ queryKey: foodsKeys.detail(updatedFood.id) });
}

/**
 * Handle realtime DELETE event for foods
 */
export function handleFoodDelete(
  payload: FoodRealtimePayload,
  queryClient: QueryClient,
  currentListId: string | null,
): void {
  const deletedFood = payload.old;

  // DELETE events don't support filters in Supabase Realtime - filter manually
  if (deletedFood.list_id && currentListId && deletedFood.list_id !== currentListId) {
    return;
  }

  // Skip if this was a recent local mutation (deduplication)
  if (deletedFood.id && mutationTracker.wasRecentlyMutated(deletedFood.id, 'DELETE')) {
    return;
  }

  // Force refetch to ensure UI updates
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  // Remove detail query if exists
  if (deletedFood.id) {
    queryClient.removeQueries({ queryKey: foodsKeys.detail(deletedFood.id) });
  }

  // Show toast for DELETE (critical action)
  const foodName = deletedFood.name || 'Un alimento';
  toast.info(`${foodName} è stato eliminato da un altro utente`);
}

/**
 * Main handler for food realtime events
 */
export function handleFoodRealtimeEvent(
  payload: FoodRealtimePayload,
  queryClient: QueryClient,
  currentListId: string | null = null,
): void {
  switch (payload.eventType) {
    case 'INSERT':
      handleFoodInsert(payload, queryClient);
      break;
    case 'UPDATE':
      handleFoodUpdate(payload, queryClient);
      break;
    case 'DELETE':
      handleFoodDelete(payload, queryClient, currentListId);
      break;
  }
}

/**
 * Handle realtime INSERT event for list_members (new member joined)
 */
export function handleListMemberInsert(
  payload: ListMemberRealtimePayload,
  queryClient: QueryClient,
  currentUserId: string,
): void {
  const newMember = payload.new;

  // Don't show notification for current user joining (that's a local action)
  if (newMember.user_id === currentUserId) {
    return;
  }

  // Force refetch of list members and foods
  queryClient.invalidateQueries({ queryKey: ['list_members'] });
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  toast.info('Un nuovo membro si è unito alla lista');
}

/**
 * Handle realtime DELETE event for list_members (member left or was removed)
 */
export function handleListMemberDelete(
  payload: ListMemberRealtimePayload,
  queryClient: QueryClient,
  currentUserId: string,
): void {
  const removedMember = payload.old;

  // If current user was removed, show message and redirect
  if (removedMember.user_id === currentUserId) {
    toast.error('Sei stato rimosso da questa lista');
    queryClient.clear();
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  // Other member left - refetch
  queryClient.invalidateQueries({ queryKey: ['list_members'] });
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  toast.info('Un membro ha lasciato la lista');
}

/**
 * Main handler for list_members realtime events
 */
export function handleListMemberEvent(
  payload: ListMemberRealtimePayload,
  queryClient: QueryClient,
  currentUserId: string,
): void {
  switch (payload.eventType) {
    case 'INSERT':
      handleListMemberInsert(payload, queryClient, currentUserId);
      break;
    case 'DELETE':
      handleListMemberDelete(payload, queryClient, currentUserId);
      break;
    case 'UPDATE':
      // list_members table doesn't have UPDATE events
      break;
  }
}
