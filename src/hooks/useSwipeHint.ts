import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const STORAGE_KEY = 'entro_hasSeenSwipeHint'

/**
 * useSwipeHint - Show first-time tooltip about swipe gestures
 *
 * Features:
 * - Shows toast on first load only
 * - Only on mobile devices
 * - Uses localStorage to track if user has seen hint
 * - Auto-dismiss after 5 seconds
 */
export function useSwipeHint() {
  const [hasShownHint, setHasShownHint] = useState(false)

  useEffect(() => {
    // Check if mobile device
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isMobileWidth = window.innerWidth < 768

    if (!hasTouchScreen || !isMobileWidth) {
      return // Not mobile, don't show hint
    }

    // Check if user has already seen the hint
    const hasSeenBefore = localStorage.getItem(STORAGE_KEY) === 'true'

    if (!hasSeenBefore && !hasShownHint) {
      // Wait 1 second after page load to show hint
      const timer = setTimeout(() => {
        toast.info('💡 Tip: Fai swipe sulle card per modificare o eliminare', {
          duration: 5000,
          position: 'top-center',
        })

        // Mark as seen
        localStorage.setItem(STORAGE_KEY, 'true')
        setHasShownHint(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [hasShownHint])
}
