/**
 * Footer Component
 * Displays legal links (Privacy Policy, Terms & Conditions, Cookie Policy)
 * Links to Aruba LegalBlink hosted documents
 * Used in Login, Signup, and other public pages
 */
export function Footer() {
  return (
    <footer className="mt-8 py-4 border-t">
      <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/privacy-policy-per-siti-web-o-e-commerce-it"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline transition-colors"
        >
          Privacy Policy
        </a>
        <span className="text-muted-foreground/50">•</span>
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/condizioni-d'uso-del-sito-it"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline transition-colors"
        >
          Termini e Condizioni
        </a>
        <span className="text-muted-foreground/50">•</span>
        <a
          href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/cookie-policy-it"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline transition-colors"
        >
          Cookie Policy
        </a>
      </div>
    </footer>
  )
}
