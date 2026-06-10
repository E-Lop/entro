/**
 * PageLoader Component
 * Full-screen loading indicator for page transitions
 */
export function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center min-h-screen"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-border border-t-primary"></div>
        <div className="text-muted-foreground">Caricamento...</div>
      </div>
    </div>
  )
}
