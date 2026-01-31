import { Link } from 'react-router-dom'

/**
 * Footer Component
 * Displays legal links (Privacy Policy, Terms & Conditions)
 * Used in Login, Signup, and other public pages
 */
export function Footer() {
  return (
    <footer className="mt-8 py-4 border-t">
      <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
        <Link
          to="/privacy"
          className="hover:text-foreground hover:underline transition-colors"
        >
          Privacy Policy
        </Link>
        <span className="text-muted-foreground/50">•</span>
        <Link
          to="/terms"
          className="hover:text-foreground hover:underline transition-colors"
        >
          Termini e Condizioni
        </Link>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-2">
        I documenti legali saranno disponibili dopo l'attivazione di Aruba LegalBlink
      </p>
    </footer>
  )
}
