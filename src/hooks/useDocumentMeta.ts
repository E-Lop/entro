import { useEffect } from 'react'

const DEFAULT_TITLE = 'entro - Combatti lo spreco alimentare'
const DEFAULT_DESCRIPTION =
  'entro ti aiuta a combattere lo spreco alimentare: gestisci le scadenze, scansiona i codici a barre, condividi liste e ricevi notifiche prima che il cibo scada.'

export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | entro` : DEFAULT_TITLE

    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', description ?? DEFAULT_DESCRIPTION)
    }
  }, [title, description])
}
