/**
 * Full-screen loading indicator shared by the auth pages while the
 * authentication status is being resolved.
 */
export function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center" role="status">
        <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="mt-4 text-sm text-muted-foreground">Caricamento...</p>
      </div>
    </div>
  )
}
