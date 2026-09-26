import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface NotificationPreferences {
  enabled: boolean
  expiry_intervals: number[]
  timezone: string
}

const QUERY_KEY = ['notification_preferences'] as const
const TEN_MINUTES = 1000 * 60 * 10

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  expiry_intervals: [3, 1, 0],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/Rome',
}

// Le colonne delle ore silenziose e del limite giornaliero restano nella
// tabella, ma l'invio non le legge più (#154): non si leggono nemmeno qui.
const PREFERENCE_FIELDS = ['enabled', 'expiry_intervals', 'timezone'] as const

export function useNotificationPreferences() {
  const user = useAuthStore((s) => s.user)

  return useQuery({
    queryKey: [...QUERY_KEY],
    queryFn: async (): Promise<NotificationPreferences> => {
      if (!user) return DEFAULT_PREFERENCES

      const { data, error } = await supabase
        .from('notification_preferences')
        .select(PREFERENCE_FIELDS.join(','))
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) return DEFAULT_PREFERENCES
      return data as unknown as NotificationPreferences
    },
    enabled: !!user,
    staleTime: TEN_MINUTES,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  return useMutation({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          { user_id: user.id, ...prefs, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY] })
    },
  })
}
