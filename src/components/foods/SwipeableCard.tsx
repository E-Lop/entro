import { useState, useRef, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import { Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/lib/haptics'
import { useIsMobile } from '@/hooks/useIsMobile'

interface SwipeableCardProps {
  children: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  className?: string
  showHintAnimation?: boolean
}

/**
 * SwipeableCard - Wrapper component for swipe gestures on mobile devices
 *
 * Features:
 * - Swipe right → Edit action (green background)
 * - Swipe left → Delete action (red background)
 * - Animated hint on first card (mini-swipe demonstration)
 * - Smooth animations with CSS transitions
 * - Works on iOS and Android
 */
export function SwipeableCard({ children, onEdit, onDelete, className, showHintAnimation = false }: SwipeableCardProps) {
  const isMobile = useIsMobile()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const thresholdTriggered = useRef(false)

  const HINT_ANIMATION_KEY = 'entro_hasSeenSwipeAnimation'

  // Animated hint: mini-swipe demonstration on first card (first time only)
  useEffect(() => {
    if (!showHintAnimation || !isMobile) return
    // Respect reduced motion: skip the auto-playing swipe demo entirely. We don't
    // mark it as "seen" so it can still play if the user later allows motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const hasSeenAnimation = localStorage.getItem(HINT_ANIMATION_KEY) === 'true'
    if (hasSeenAnimation) return

    // Wait 2 seconds after page load, then show hint animation
    const timer = setTimeout(() => {
      setIsAnimating(true)

      // Swipe right 30px
      setSwipeOffset(30)

      // Hold for 400ms, then return to center
      setTimeout(() => {
        setSwipeOffset(0)

        // Mark animation as shown after it completes
        setTimeout(() => {
          setIsAnimating(false)
          localStorage.setItem(HINT_ANIMATION_KEY, 'true')
        }, 300)
      }, 400)
    }, 2000)

    return () => clearTimeout(timer)
  }, [showHintAnimation, isMobile])

  // Swipe handlers
  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!isMobile) return

      // Limit swipe distance to ±150px
      const offset = Math.max(-150, Math.min(150, eventData.deltaX))
      setSwipeOffset(offset)

      // Haptic feedback when reaching the action threshold
      if (Math.abs(offset) >= 80 && !thresholdTriggered.current) {
        thresholdTriggered.current = true
        triggerHaptic('nudge')
      } else if (Math.abs(offset) < 80) {
        thresholdTriggered.current = false
      }
    },
    onSwiped: (eventData) => {
      if (!isMobile) {
        setSwipeOffset(0)
        return
      }

      const threshold = 80 // pixels to trigger action

      // Swipe right → Edit
      if (eventData.deltaX > threshold && onEdit) {
        triggerAction('edit')
      }
      // Swipe left → Delete
      else if (eventData.deltaX < -threshold && onDelete) {
        triggerAction('delete')
      }
      // Not enough swipe, reset
      else {
        resetSwipe()
      }

      thresholdTriggered.current = false
    },
    trackMouse: false, // Only track touch events
    trackTouch: true,
  })

  const triggerAction = (action: 'edit' | 'delete') => {
    triggerHaptic('buzz')
    setIsAnimating(true)

    // Animate to full swipe
    setSwipeOffset(action === 'edit' ? 150 : -150)

    // Trigger action after animation
    setTimeout(() => {
      if (action === 'edit' && onEdit) {
        onEdit()
      } else if (action === 'delete' && onDelete) {
        onDelete()
      }
      resetSwipe()
    }, 200)
  }

  const resetSwipe = () => {
    setIsAnimating(true)
    setSwipeOffset(0)
    setTimeout(() => setIsAnimating(false), 200)
  }

  // Calculate background opacity based on swipe distance
  const getBackgroundOpacity = () => {
    return Math.abs(swipeOffset) / 150
  }

  // If not mobile, render children without swipe functionality
  if (!isMobile) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className="relative overflow-hidden" ref={cardRef}>
      {/* Background layers that appear during swipe */}

      {/* Edit background (brand green) - appears on swipe right */}
      <div
        className={cn(
          'absolute inset-0 bg-primary flex items-center justify-start px-6',
          'transition-opacity duration-200'
        )}
        style={{ opacity: swipeOffset > 0 ? getBackgroundOpacity() : 0 }}
      >
        <Edit className="h-6 w-6 text-primary-foreground" />
      </div>

      {/* Delete background (destructive) - appears on swipe left */}
      <div
        className={cn(
          'absolute inset-0 bg-destructive flex items-center justify-end px-6',
          'transition-opacity duration-200'
        )}
        style={{ opacity: swipeOffset < 0 ? getBackgroundOpacity() : 0 }}
      >
        <Trash2 className="h-6 w-6 text-destructive-foreground" />
      </div>

      {/* Card content with swipe transform */}
      <div
        {...handlers}
        className={cn('relative bg-card', className)}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          // The inline transition governs the swipe animation (it always wins over
          // a Tailwind class); `none` while idle so dragging tracks the finger 1:1.
          transition: isAnimating ? 'transform 0.2s var(--ease-out-quart)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
