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
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Mobile reconnection tracking
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const hasEverConnectedRef = useRef(false);

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

    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setIsConnected(false);
      setReconnectTrigger(prev => prev + 1);
    }, delay);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function setupSubscription() {
      try {
        const { list, error: listError } = await getUserList();

        if (!mounted) return;

        if (listError || !list) {
          console.warn('[useRealtimeFoods] No list found for user:', listError);
          setError('Nessuna lista trovata per questo utente');
          return;
        }

        setListId(list.id);
        setError(null);

        const channelName = getChannelName('foods', list.id);

        // Remove any existing channel (important for React Strict Mode)
        const existingChannel = supabase.getChannels().find((ch) => ch.topic === channelName);
        if (existingChannel) {
          await existingChannel.unsubscribe();
          supabase.removeChannel(existingChannel);
        }

        channelRef.current = supabase.channel(channelName);

        // Subscribe to INSERT events
        channelRef.current.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'foods',
            filter: `list_id=eq.${list.id}`,
          },
          (payload) => {
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )

        // Subscribe to UPDATE events
        channelRef.current.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'foods',
            filter: `list_id=eq.${list.id}`,
          },
          (payload) => {
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )

        // Subscribe to DELETE events (no filter - not supported by Supabase)
        channelRef.current.on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'foods',
          },
          (payload) => {
            handleFoodRealtimeEvent(
              payload as unknown as FoodRealtimePayload,
              queryClient,
              list.id,
            );
          },
        )
          .subscribe((status) => {
            if (!mounted) return;

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
              reconnectAttemptsRef.current = 0;

              if (reconnectTimeoutRef.current !== null) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
              }

              hasEverConnectedRef.current = true;
              queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              if (!import.meta.env.DEV) {
                console.error('[useRealtimeFoods] Channel error in production');
                manualReconnect();
              }
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setError('Timeout connessione realtime');
              console.error('[useRealtimeFoods] Channel timed out');
              manualReconnect();
            } else if (status === 'CLOSED') {
              setIsConnected(false);
            }
          });
      } catch (err) {
        if (!mounted) return;
        console.error('[useRealtimeFoods] Error setting up subscription:', err);
        setError('Errore nella configurazione del realtime');
      }
    }

    setupSubscription();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [queryClient, manualReconnect, reconnectTrigger]);

  // Page Visibility Handler - invalidate queries when returning to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [queryClient]);

  // Window Focus Handler - fallback for browsers with poor visibilitychange support
  useEffect(() => {
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [queryClient]);

  // Network Status Handler - reconnect and refresh when network is restored
  useEffect(() => {
    if (isOnline && listId && hasEverConnectedRef.current) {
      // Wait for network to stabilize (iOS Safari needs time for DNS resolution)
      const networkRestoreTimeout = setTimeout(async () => {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
            console.warn('[Realtime] Session refresh failed after network restore');
            return;
          }
        } catch (err) {
          console.error('[Realtime] Error refreshing session:', err);
          return;
        }

        queryClient.invalidateQueries({ queryKey: ['foods', 'list'] });

        if (!isConnected) {
          manualReconnect();
        }
      }, 2000);

      return () => clearTimeout(networkRestoreTimeout);
    }
  }, [isOnline, isConnected, listId, manualReconnect, queryClient]);

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
