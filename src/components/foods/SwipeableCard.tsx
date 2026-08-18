import { useState, useRef, useEffect, useId } from 'react'
import { useSwipeable } from 'react-swipeable'
import { Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/lib/haptics'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useSwipeableCard } from '@/hooks/useSwipeableCard'

interface SwipeableCardProps {
  children: React.ReactNode
  /** Id stabile per il coordinamento "una sola card aperta" (es. food.id). */
  id?: string
  onEdit?: () => void
  onDelete?: () => void
  /**
   * Editor rapido mostrato quando la card si aggancia aperta (swipe → destra).
   * Riceve `close` per riportare la card allo stato chiuso (es. dopo "Modifica completa").
   * Se assente, lo swipe → destra ricade sul comportamento precedente (`onEdit`).
   */
  renderQuickEditor?: (api: { close: () => void }) => React.ReactNode
  className?: string
  showHintAnimation?: boolean
}

const SLIVER = 40 // px della card originale lasciati visibili a destra come appiglio
const THRESHOLD = 80 // px per attivare azione/aggancio
const DELETE_TRAVEL = 150 // px di scorrimento per la conferma delete
const OPEN_MS = 200 // durata di apertura/aggancio e delle azioni
const CLOSE_MS = 320 // chiusura un po' più lenta, per accompagnare il ritorno della card
const HINT_ANIMATION_KEY = 'entro_hasSeenSwipeAnimation'

/**
 * SwipeableCard — gesti orizzontali sulle card (solo mobile).
 *
 * - Swipe verso **sinistra** → Elimina (pannello rosso), invariato.
 * - Swipe verso **destra**:
 *   - con `renderQuickEditor`: la card si **aggancia aperta** lasciando uno spicchio a
 *     destra e rivela l'editor rapido di quantità sullo stesso asse orizzontale;
 *   - senza `renderQuickEditor`: apre la modifica completa (`onEdit`), come prima.
 * - Una sola card aperta per volta + chiusura allo scroll (via `useSwipeableCard`).
 * - `prefers-reduced-motion`: niente slide, transizione immediata.
 */
export function SwipeableCard({
  children,
  id,
  onEdit,
  onDelete,
  renderQuickEditor,
  className,
  showHintAnimation = false,
}: SwipeableCardProps) {
  const isMobile = useIsMobile()
  const generatedId = useId()
  const cardId = id ?? generatedId
  const { isOpen, open, close } = useSwipeableCard(cardId)

  const [offset, setOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animMs, setAnimMs] = useState(OPEN_MS)
  const [cardWidth, setCardWidth] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const thresholdTriggered = useRef(false)

  const reduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const hasQuickEditor = !!renderQuickEditor
  const openOffset = Math.max(0, cardWidth - SLIVER)
  const canOpen = hasQuickEditor && openOffset > 0

  // Misura la larghezza della card per calcolare la posizione di aggancio.
  useEffect(() => {
    if (!isMobile) return
    const el = cardRef.current
    if (!el) return
    const measure = () => setCardWidth(el.getBoundingClientRect().width)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [isMobile])

  // Anima verso lo stato di riposo quando il controller cambia (aggancio, scroll,
  // apertura di un'altra card, "Modifica completa").
  useEffect(() => {
    if (draggingRef.current) return
    const duration = isOpen ? OPEN_MS : CLOSE_MS
    setAnimMs(duration)
    setIsAnimating(true)
    setOffset(isOpen ? openOffset : 0)
    const t = setTimeout(() => setIsAnimating(false), duration)
    return () => clearTimeout(t)
  }, [isOpen, openOffset])

  // All'apertura porta il focus nell'editor (torna alla card alla chiusura via tap/scroll).
  useEffect(() => {
    if (isOpen) editorRef.current?.focus()
  }, [isOpen])

  // Hint animato: mini-swipe verso destra sulla prima card (una volta sola).
  useEffect(() => {
    if (!showHintAnimation || !isMobile || reduceMotion) return
    if (localStorage.getItem(HINT_ANIMATION_KEY) === 'true') return

    const timer = setTimeout(() => {
      setIsAnimating(true)
      setOffset(30)
      setTimeout(() => {
        setOffset(0)
        setTimeout(() => {
          setIsAnimating(false)
          localStorage.setItem(HINT_ANIMATION_KEY, 'true')
        }, 300)
      }, 400)
    }, 2000)

    return () => clearTimeout(timer)
  }, [showHintAnimation, isMobile, reduceMotion])

  const animateTo = (target: number, duration = OPEN_MS) => {
    setAnimMs(duration)
    setIsAnimating(true)
    setOffset(target)
    setTimeout(() => setIsAnimating(false), duration)
  }

  const triggerAction = (action: 'edit' | 'delete') => {
    triggerHaptic('buzz')
    setAnimMs(OPEN_MS)
    setIsAnimating(true)
    setOffset(action === 'edit' ? cardWidth || DELETE_TRAVEL : -DELETE_TRAVEL)
    setTimeout(() => {
      if (action === 'edit') onEdit?.()
      else onDelete?.()
      animateTo(0)
    }, OPEN_MS)
  }

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (!isMobile) return
      draggingRef.current = true

      const base = isOpen ? openOffset : 0
      const upper = canOpen ? openOffset : onEdit ? DELETE_TRAVEL : 0
      const lower = isOpen ? 0 : onDelete ? -DELETE_TRAVEL : 0
      const raw = Math.max(lower, Math.min(upper, base + e.deltaX))
      setOffset(raw)

      const crossed = Math.abs(e.deltaX) >= THRESHOLD
      if (crossed && !thresholdTriggered.current) {
        thresholdTriggered.current = true
        triggerHaptic('nudge')
      } else if (!crossed) {
        thresholdTriggered.current = false
      }
    },
    onSwiped: (e) => {
      thresholdTriggered.current = false
      draggingRef.current = false
      if (!isMobile) {
        setOffset(0)
        return
      }

      // Card già aperta: swipe a sinistra la chiude, altrimenti torna aperta.
      if (isOpen) {
        if (e.deltaX < -THRESHOLD) close()
        else animateTo(openOffset)
        return
      }

      // Card chiusa.
      if (e.deltaX > THRESHOLD) {
        if (canOpen) open()
        else if (onEdit) triggerAction('edit')
        else animateTo(0)
      } else if (e.deltaX < -THRESHOLD && onDelete) {
        triggerAction('delete')
      } else {
        animateTo(0)
      }
    },
    trackMouse: false,
    trackTouch: true,
  })

  // Desktop: nessuno swipe, i pulsanti nel footer gestiscono le azioni.
  if (!isMobile) {
    return <div className={className}>{children}</div>
  }

  const deleteRevealOpacity = offset < 0 ? Math.min(1, Math.abs(offset) / DELETE_TRAVEL) : 0
  const editRevealOpacity = !isOpen && offset > 0 ? Math.min(1, offset / DELETE_TRAVEL) : 0

  return (
    <div className="relative overflow-hidden" ref={cardRef}>
      {/* Sfondo Elimina (destructive) — rivelato dallo swipe a sinistra */}
      <div
        className="absolute inset-0 bg-destructive flex items-center justify-end px-6 transition-opacity duration-200"
        style={{ opacity: deleteRevealOpacity }}
        aria-hidden="true"
      >
        <Trash2 className="h-6 w-6 text-destructive-foreground" />
      </div>

      {/* Sfondo Modifica (verde) — affordance durante lo swipe a destra / fallback */}
      {!isOpen && (
        <div
          className="absolute inset-0 bg-primary flex items-center justify-start px-6 transition-opacity duration-200"
          style={{ opacity: editRevealOpacity }}
          aria-hidden="true"
        >
          <Edit className="h-6 w-6 text-primary-foreground" />
        </div>
      )}

      {/* Editor rapido — mostrato quando la card è agganciata aperta */}
      {isOpen && renderQuickEditor && (
        <div
          ref={editorRef}
          tabIndex={-1}
          className="absolute inset-y-0 left-0 outline-none"
          style={{ width: openOffset }}
        >
          {renderQuickEditor({ close })}
        </div>
      )}

      {/* Contenuto della card, traslato orizzontalmente */}
      <div
        {...handlers}
        onClick={isOpen ? () => close() : undefined}
        className={cn(
          'relative bg-card',
          isOpen && 'cursor-pointer shadow-[-8px_0_16px_rgba(0,0,0,0.15)]',
          className,
        )}
        style={{
          transform: `translateX(${offset}px)`,
          // Idle/drag: nessuna transizione (tracking 1:1). Solo durante le animazioni
          // di riposo/azione, e mai con reduced-motion (snap immediato).
          transition:
            !draggingRef.current && isAnimating && !reduceMotion
              ? `transform ${animMs}ms var(--ease-out-quart)`
              : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}
