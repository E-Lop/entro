import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { ArrowLeft, Shield } from 'lucide-react'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

/**
 * Privacy Policy Page - Placeholder
 * This page will be populated with the Privacy Policy from Aruba LegalBlink
 */
export function PrivacyPolicyPage() {
  useDocumentMeta('Privacy Policy')
  return (
    <div className="min-h-screen bg-muted p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Button asChild variant="ghost" className="mb-4 min-h-[44px]">
          <Link to="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna indietro
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <CardTitle as="h1" className="text-3xl">Privacy Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="max-w-none space-y-4 text-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-warning mt-0">
                Documento in preparazione
              </h2>
              <p className="text-foreground/80 mb-0">
                La Privacy Policy sarà disponibile dopo l'attivazione del servizio Aruba
                LegalBlink Advanced. Il documento sarà redatto da consulenti legali e
                personalizzato per entro.
              </p>
            </div>

            <h2>Cosa raccoglie entro</h2>
            <p>
              L'app entro raccoglie e memorizza i seguenti dati personali:
            </p>
            <ul>
              <li>
                <strong>Dati di autenticazione:</strong> email, password (hash), nome
                completo
              </li>
              <li>
                <strong>Dati applicazione:</strong> alimenti tracciati, immagini
                caricate, liste condivise, codici invito
              </li>
              <li>
                <strong>Dati locali:</strong> preferenze tema (localStorage), flag
                tutorial
              </li>
              <li>
                <strong>Cache:</strong> Service Worker per funzionalità offline (PWA)
              </li>
            </ul>

            <h2>Base legale del trattamento</h2>
            <p>
              Il trattamento dei dati personali avviene sulla base del consenso
              dell'utente (GDPR Art. 6.1.a) per l'erogazione del servizio.
            </p>

            <h2>I tuoi diritti GDPR</h2>
            <p>In conformità al GDPR, hai diritto a:</p>
            <ul>
              <li>
                <strong>Accesso ai dati (Art. 15):</strong> visualizzare i tuoi dati
                personali
              </li>
              <li>
                <strong>Portabilità (Art. 20):</strong> esportare i tuoi dati in formato
                JSON
              </li>
              <li>
                <strong>Cancellazione (Art. 17):</strong> eliminare permanentemente il
                tuo account
              </li>
              <li>
                <strong>Rettifica (Art. 16):</strong> modificare dati non corretti
              </li>
            </ul>

            <p className="text-sm text-muted-foreground">
              Documento provvisorio. Privacy Policy completa disponibile dopo attivazione
              Aruba LegalBlink.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default PrivacyPolicyPage
