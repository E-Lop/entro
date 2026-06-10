/**
 * Footer Component
 * Displays legal links (Privacy Policy, Terms & Conditions, Cookie Policy)
 * Links to Aruba LegalBlink hosted documents
 * Used in Login, Signup, and other public pages
 */
export function Footer() {
  return (
    <footer className="mt-8 py-4 border-t">
      <div className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-muted-foreground">
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/privacy-policy-per-siti-web-o-e-commerce-it"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center px-2 hover:text-foreground hover:underline transition-colors"
        >
          Privacy Policy
          <span className="sr-only"> (si apre in una nuova scheda)</span>
        </a>
        <span aria-hidden="true" className="text-muted-foreground/50">•</span>
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/condizioni-d'uso-del-sito-it"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center px-2 hover:text-foreground hover:underline transition-colors"
        >
          Termini e Condizioni
          <span className="sr-only"> (si apre in una nuova scheda)</span>
        </a>
        <span aria-hidden="true" className="text-muted-foreground/50">•</span>
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/cookie-policy-it"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center px-2 hover:text-foreground hover:underline transition-colors"
        >
          Cookie Policy
          <span className="sr-only"> (si apre in una nuova scheda)</span>
        </a>
      </div>
    </footer>
  )
}
