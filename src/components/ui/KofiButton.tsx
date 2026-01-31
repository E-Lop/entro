/**
 * Ko-fi Button Component
 * Displays a Ko-fi donation button linking to the creator's Ko-fi page
 *
 * Mobile-friendly implementation with responsive sizing and proper touch targets
 * Only renders if VITE_KOFI_URL is configured (allows forks to disable)
 */
export function KofiButton() {
  const kofiUrl = import.meta.env.VITE_KOFI_URL

  // Don't render if Ko-fi URL is not configured (useful for forks)
  if (!kofiUrl) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-3 py-8 px-4">
      <p className="text-sm text-muted-foreground text-center">
        Ti piace questo progetto?
      </p>
      <a
        href={kofiUrl}
        target='_blank'
        rel='noopener noreferrer'
        className="flex items-center hover:opacity-80 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg min-h-[44px]"
        aria-label="Supportami su Ko-fi"
      >
        <img
          className="h-9 sm:h-10 w-auto"
          style={{ border: 0 }}
          src='https://storage.ko-fi.com/cdn/kofi6.png?v=6'
          alt='Buy Me a Coffee at ko-fi.com'
        />
      </a>
    </div>
  )
}
