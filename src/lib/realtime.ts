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
  payload: FoodRealtimePayload,
  queryClient: QueryClient,
): void {
  const newFood = payload.new;

  // TEMPORARY: Disable deduplication for INSERT to debug issue
  // TODO: Re-enable after finding root cause
  // const wasRecentMutation = mutationTracker.wasRecentlyMutated(newFood.id, 'INSERT');
  // if (wasRecentMutation) {
  //   console.log('[Realtime] Skipping duplicate INSERT for', newFood.id, '(was tracked as local mutation)');
  //   return;
  // }

  console.log('[Realtime] Processing INSERT event for food:', newFood.name, 'id:', newFood.id);

  // Force refetch to ensure UI updates
  // Using invalidateQueries is more reliable than setQueriesData for triggering re-renders
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  // NO toast for INSERT (per user preferences - only visual highlight)
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
    console.log('[Realtime] Skipping duplicate UPDATE for', updatedFood.id);
    return;
  }

  console.log('[Realtime] Received UPDATE event for food:', updatedFood.name);

  // Force refetch to ensure UI updates
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
  queryClient.invalidateQueries({ queryKey: foodsKeys.detail(updatedFood.id) });

  // NO toast for UPDATE (per user preferences - only visual highlight)
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

  console.log('[Realtime] Received DELETE event:', {
    foodId: deletedFood.id,
    foodName: deletedFood.name,
    foodListId: deletedFood.list_id,
    currentListId: currentListId,
  });

  // IMPORTANT: DELETE events don't support filters in Supabase Realtime
  // We must filter manually on the client side
  // Skip if from different list
  if (deletedFood.list_id && currentListId && deletedFood.list_id !== currentListId) {
    console.log('[Realtime] Ignoring DELETE event from different list');
    return;
  }

  // Skip if this was a recent local mutation (deduplication)
  if (deletedFood.id && mutationTracker.wasRecentlyMutated(deletedFood.id, 'DELETE')) {
    console.log('[Realtime] Skipping duplicate DELETE for', deletedFood.id);
    return;
  }

  console.log('[Realtime] Processing DELETE event for food:', deletedFood.name);

  // Force refetch to ensure UI updates
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  // Remove detail query if exists
  if (deletedFood.id) {
    queryClient.removeQueries({ queryKey: foodsKeys.detail(deletedFood.id) });
  }

  // Show toast for DELETE (per user preferences - critical action)
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
    default:
      console.warn('[Realtime] Unknown event type:', payload.eventType);
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

  console.log('[Realtime] New member joined list:', newMember.user_id);

  // Force refetch of list members and foods (new member might affect data)
  queryClient.invalidateQueries({ queryKey: ['list_members'] });
  queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });

  // Show toast notification
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

  console.log('[Realtime] Member left list:', removedMember.user_id);

  // If current user was removed, show message and redirect
  if (removedMember.user_id === currentUserId) {
    toast.error('Sei stato rimosso da questa lista');

    // Clear all cache
    queryClient.clear();

    // Redirect to dashboard (will show "create list" screen)
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
      // list_members table doesn't have UPDATE events (only INSERT/DELETE)
      break;
    default:
      console.warn('[Realtime] Unknown event type:', payload.eventType);
  }
}
