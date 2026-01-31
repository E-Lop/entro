/**
 * Hook for real-time synchronization of foods table
 * - Subscribes to INSERT/UPDATE/DELETE events for foods
 * - Updates React Query cache in real-time
 * - Handles deduplication of local mutations
 * - Implements mobile recovery logic for iOS Safari and Android Chrome
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { getUserList } from '../lib/invites';
import {
  handleFoodRealtimeEvent,
  mutationTracker,
} from '../lib/realtime';
import type { FoodRealtimePayload } from '../lib/realtime.types';
import { getChannelName } from '../utils/realtimeHelpers';
import { useNetworkStatus } from './useNetworkStatus';

/**
 * Hook for subscribing to real-time foods updates
 * Should be called at the top-level component (e.g., DashboardPage)
 */
export function useRealtimeFoods() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mobile reconnection tracking
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Network status monitoring
  const isOnline = useNetworkStatus();

  /**
   * Manual reconnection logic for mobile devices
   * Safari doesn't always send close events when suspending connections
   */
  const manualReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached');
      toast.error('Impossibile riconnettersi. Ricarica la pagina.');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000);

    console.log(`[Realtime] Attempting reconnect #${reconnectAttemptsRef.current} in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[Realtime] Executing reconnect attempt');

      // Unsubscribe completely and trigger re-setup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setIsConnected(false);
      // The main useEffect will re-run and create a new subscription
    }, delay);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Mobile debug logging
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('[Realtime Mobile Debug]', {
      isMobile,
      isPageVisible: !document.hidden,
      isOnline: navigator.onLine,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

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
        channelRef.current = supabase.channel(channelName);

        // Subscribe to INSERT events with filter
        channelRef.current.on(
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
        channelRef.current.on(
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
        channelRef.current.on(
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
              reconnectAttemptsRef.current = 0; // Reset on success
              console.log('[useRealtimeFoods] ✅ Successfully subscribed to foods realtime channel');

              // Invalidate queries to catch up on any missed updates
              queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              // In development with React Strict Mode, channel errors are expected
              if (!import.meta.env.DEV) {
                console.error('[useRealtimeFoods] ⚠️ Channel error in production, attempting reconnect');
                manualReconnect();
              } else {
                console.warn('[useRealtimeFoods] ⚠️ Channel error (expected in dev mode with Strict Mode)');
              }
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setError('Timeout connessione realtime');
              console.error('[useRealtimeFoods] ❌ Channel timed out, attempting reconnect');
              manualReconnect();
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
      if (channelRef.current) {
        console.log('[useRealtimeFoods] Cleaning up subscription');
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [queryClient, manualReconnect]); // Added dependencies

  // Page Visibility Handler - invalidate queries when returning to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.log('[Realtime] Page visibility changed:', isVisible ? 'visible' : 'hidden');

      if (isVisible && isConnected) {
        console.log('[Realtime] Page became visible, invalidating queries');
        queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, queryClient]);

  // Window Focus Handler - fallback for browsers with poor visibilitychange support
  useEffect(() => {
    const handleFocus = () => {
      console.log('[Realtime] Window focus gained');
      if (isConnected) {
        queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, queryClient]);

  // Network Status Handler - reconnect when network is restored
  useEffect(() => {
    if (isOnline && !isConnected && listId) {
      console.log('[Realtime] Network restored, forcing reconnect');
      manualReconnect();
    }
  }, [isOnline, isConnected, listId, manualReconnect]);

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
