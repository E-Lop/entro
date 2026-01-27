/**
 * Hook for real-time synchronization of foods table
 * - Subscribes to INSERT/UPDATE/DELETE events for foods
 * - Updates React Query cache in real-time
 * - Handles deduplication of local mutations
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserList } from '../lib/invites';
import {
  handleFoodRealtimeEvent,
  mutationTracker,
} from '../lib/realtime';
import type { FoodRealtimePayload } from '../lib/realtime.types';
import { getChannelName } from '../utils/realtimeHelpers';

/**
 * Hook for subscribing to real-time foods updates
 * Should be called at the top-level component (e.g., DashboardPage)
 */
export function useRealtimeFoods() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;

    // Async function to setup subscription
    async function setupSubscription() {
      try {
        // Get user's list ID
        const { list, error: listError } = await getUserList();

        if (!mounted) return; // Component unmounted during async call

        if (listError || !list) {
          console.warn('[useRealtimeFoods] No list found for user:', listError);
          setError('Nessuna lista trovata per questo utente');
          return;
        }

        setListId(list.id);
        setError(null);
        console.log('[useRealtimeFoods] Setting up subscription for list:', list.id);

        // Create channel with unique name
        const channelName = getChannelName('foods', list.id);

        // Remove any existing channel with this name (important for React Strict Mode)
        const existingChannel = supabase.getChannels().find((ch) => ch.topic === channelName);
        if (existingChannel) {
          console.log('[useRealtimeFoods] Removing existing channel:', channelName);
          await existingChannel.unsubscribe();
          supabase.removeChannel(existingChannel);
        }

        // Create new channel
        channel = supabase.channel(channelName);

        // Subscribe to INSERT events with filter
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'foods',
            filter: `list_id=eq.${list.id}`,
          },
          (payload) => {
            console.log('[useRealtimeFoods] Received INSERT event:', payload);
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )

        // Subscribe to UPDATE events with filter
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'foods',
            filter: `list_id=eq.${list.id}`,
          },
          (payload) => {
            console.log('[useRealtimeFoods] Received UPDATE event:', payload);
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )

        // Subscribe to DELETE events (no filter - not supported by Supabase)
        // We filter manually in handleFoodDelete
        channel.on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'foods',
            // No filter - DELETE events don't support filters
          },
          (payload) => {
            console.log('[useRealtimeFoods] Received DELETE event:', payload);
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )
          .subscribe((status) => {
            if (!mounted) return;

            console.log('[useRealtimeFoods] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
              console.log('[useRealtimeFoods] ✅ Successfully subscribed to foods realtime channel');
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              // In development with React Strict Mode, channel errors are expected
              // due to double-mounting. This is normal and realtime will reconnect.
              console.warn('[useRealtimeFoods] ⚠️ Channel error (expected in dev mode with Strict Mode)');
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setError('Timeout connessione realtime');
              console.error('[useRealtimeFoods] Channel timed out');
            } else if (status === 'CLOSED') {
              setIsConnected(false);
              console.log('[useRealtimeFoods] Channel closed');
            }
          });
      } catch (err) {
        if (!mounted) return;
        console.error('[useRealtimeFoods] Error setting up subscription:', err);
        setError('Errore nella configurazione del realtime');
      }
    }

    setupSubscription();

    // Cleanup function
    return () => {
      mounted = false;
      if (channel) {
        console.log('[useRealtimeFoods] Cleaning up subscription');
        channel.unsubscribe();
        supabase.removeChannel(channel);
        setIsConnected(false);
      }
    };
  }, []); // Empty dependency array - setup once on mount

  // On reconnect, invalidate queries to fetch any missed updates
  useEffect(() => {
    if (isConnected && listId) {
      console.log('[useRealtimeFoods] Reconnected - invalidating queries to catch up');
      queryClient.invalidateQueries({ queryKey: ['foods'] });
    }
  }, [isConnected, listId, queryClient]);

  return {
    isConnected,
    listId,
    error,
  };
}

/**
 * Export mutation tracker for use in mutation hooks
 */
export { mutationTracker };
