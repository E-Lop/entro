import { useState, useRef, useEffect } from 'react'
import { useSwipeable } from 'react-swipeable'
import { Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwipeableCardProps {
  children: React.ReactNode
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

/**
 * SwipeableCard - Wrapper component for swipe gestures on mobile devices
 *
 * Features:
 * - Swipe right → Edit action (green background)
 * - Swipe left → Delete action (red background)
 * - Visual cues (subtle lines) only on mobile
 * - Smooth animations with CSS transitions
 * - Works on iOS and Android
 */
export function SwipeableCard({ children, onEdit, onDelete, className }: SwipeableCardProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Detect if device is touch-enabled (mobile)
  useEffect(() => {
    const checkMobile = () => {
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      const isMobileWidth = window.innerWidth < 768
      setIsMobile(hasTouchScreen && isMobileWidth)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Swipe handlers
  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      if (!isMobile) return

      // Limit swipe distance to ±150px
      const offset = Math.max(-150, Math.min(150, eventData.deltaX))
      setSwipeOffset(offset)
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
    },
    trackMouse: false, // Only track touch events
    trackTouch: true,
  })

  const triggerAction = (action: 'edit' | 'delete') => {
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

      {/* Edit background (green) - appears on swipe right */}
      <div
        className={cn(
          'absolute inset-0 bg-green-500 flex items-center justify-start px-6',
          'transition-opacity duration-200'
        )}
        style={{ opacity: swipeOffset > 0 ? getBackgroundOpacity() : 0 }}
      >
        <Edit className="h-6 w-6 text-white" />
      </div>

      {/* Delete background (red) - appears on swipe left */}
      <div
        className={cn(
          'absolute inset-0 bg-red-500 flex items-center justify-end px-6',
          'transition-opacity duration-200'
        )}
        style={{ opacity: swipeOffset < 0 ? getBackgroundOpacity() : 0 }}
      >
        <Trash2 className="h-6 w-6 text-white" />
      </div>

      {/* Card content with swipe transform */}
      <div
        {...handlers}
        className={cn(
          'relative bg-white',
          isAnimating ? 'transition-transform duration-200 ease-out' : '',
          className
        )}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isAnimating ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Visual cues - subtle lines on edges (only mobile) */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-40 pointer-events-none">
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
        </div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 opacity-40 pointer-events-none">
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
          <div className="w-1 h-3 bg-slate-500 rounded-full" />
        </div>

        {children}
      </div>
    </div>
  )
}
