import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { ArrowLeft, FileText } from 'lucide-react'

/**
 * Terms & Conditions Page - Placeholder
 * This page will be populated with the Terms from Aruba LegalBlink
 */
export function TermsPage() {
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
              <FileText className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Termini e Condizioni</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-amber-900 mt-0">
                Documento in Preparazione
              </h3>
              <p className="text-amber-800 mb-0">
                I Termini e Condizioni saranno disponibili dopo l'attivazione del servizio
                Aruba LegalBlink Advanced. Il documento sarà redatto da consulenti legali e
                personalizzato per entro.
              </p>
            </div>

            <h2>Servizio</h2>
            <p>
              entro è un'applicazione web (PWA) per il tracciamento delle scadenze degli
              alimenti. Il servizio permette di:
            </p>
            <ul>
              <li>Aggiungere e monitorare alimenti con date di scadenza</li>
              <li>Caricare immagini degli alimenti</li>
              <li>Condividere liste con altri utenti</li>
              <li>Ricevere notifiche per scadenze imminenti</li>
              <li>Funzionalità offline tramite Service Worker</li>
            </ul>

            <h2>Account Utente</h2>
            <p>
              Per utilizzare entro, devi creare un account fornendo:
            </p>
            <ul>
              <li>Indirizzo email valido</li>
              <li>Password sicura</li>
              <li>Nome completo</li>
            </ul>
            <p>
              Sei responsabile della sicurezza del tuo account e della riservatezza della
              tua password.
            </p>

            <h2>Uso del Servizio</h2>
            <p>Utilizzando entro, accetti di:</p>
            <ul>
              <li>Fornire informazioni accurate e veritiere</li>
              <li>Non utilizzare il servizio per scopi illegali</li>
              <li>Non caricare contenuti offensivi o inappropriati</li>
              <li>Rispettare i diritti degli altri utenti</li>
            </ul>

            <h2>Limitazione di Responsabilità</h2>
            <p>
              entro è fornito "così com'è" senza garanzie di alcun tipo. Non siamo
              responsabili per eventuali danni derivanti dall'uso del servizio.
            </p>

            <p className="text-sm text-muted-foreground">
              Documento provvisorio. Termini e Condizioni completi disponibili dopo
              attivazione Aruba LegalBlink.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default TermsPage
