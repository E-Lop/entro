import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { ArrowLeft, Shield } from 'lucide-react'

/**
 * Privacy Policy Page - Placeholder
 * This page will be populated with the Privacy Policy from Aruba LegalBlink
 */
export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <Link to="/login">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna indietro
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Privacy Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-amber-900 mt-0">
                Documento in Preparazione
              </h3>
              <p className="text-amber-800 mb-0">
                La Privacy Policy sarà disponibile dopo l'attivazione del servizio Aruba
                LegalBlink Advanced. Il documento sarà redatto da consulenti legali e
                personalizzato per entro.
              </p>
            </div>

            <h2>Cosa Raccoglie entro</h2>
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

            <h2>Base Legale del Trattamento</h2>
            <p>
              Il trattamento dei dati personali avviene sulla base del consenso
              dell'utente (GDPR Art. 6.1.a) per l'erogazione del servizio.
            </p>

            <h2>I Tuoi Diritti GDPR</h2>
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
