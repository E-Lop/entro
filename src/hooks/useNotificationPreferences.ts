import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface NotificationPreferences {
  enabled: boolean
  expiry_intervals: number[]
  quiet_hours_enabled: boolean
  quiet_hours_start: number
  quiet_hours_end: number
  max_notifications_per_day: number
  timezone: string
}

const QUERY_KEY = ['notification_preferences'] as const
const TEN_MINUTES = 1000 * 60 * 10

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  expiry_intervals: [3, 1, 0],
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 8,
  max_notifications_per_day: 5,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/Rome',
}

const PREFERENCE_FIELDS = [
  'enabled', 'expiry_intervals', 'quiet_hours_enabled',
  'quiet_hours_start', 'quiet_hours_end', 'max_notifications_per_day', 'timezone',
] as const

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
