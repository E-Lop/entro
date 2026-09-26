import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { AccountSection } from '../components/settings/AccountSection'
import { NotificationSettings } from '../components/settings/NotificationSettings'
import { HapticSettings } from '../components/settings/HapticSettings'
import { DataExportButton } from '../components/settings/DataExportButton'
import { DeleteAccountDialog } from '../components/settings/DeleteAccountDialog'
import { Shield, Download, AlertTriangle, Mail } from 'lucide-react'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export function SettingsPage() {
  useDocumentMeta('Impostazioni')
  return (
    <div className="max-w-4xl mx-auto space-y-sections">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Impostazioni</h1>
        <p className="text-muted-foreground mt-2">
          Gestisci il tuo account e le tue preferenze sulla privacy
        </p>
      </div>

      {/* Account Section */}
      <AccountSection />

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Haptic Feedback Settings */}
      <HapticSettings />

      {/* Support Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-inner">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle as="h2">Supporto</CardTitle>
          </div>
          <CardDescription>
            Hai bisogno di aiuto o vuoi inviarci un suggerimento?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="mailto:support@entroapp.it"
            className="text-primary hover:underline text-sm"
          >
            Scrivici a support@entroapp.it
          </a>
        </CardContent>
      </Card>

      {/* Privacy & Data Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-inner">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle as="h2">Privacy e dati</CardTitle>
          </div>
          <CardDescription>
            Gestisci i tuoi dati personali e le impostazioni sulla privacy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-blocks">
          {/* Data Export */}
          <div className="space-y-inner">
            <div className="flex items-start gap-inner">
              <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium">Esporta i tuoi dati</h3>
                <p className="text-sm text-muted-foreground">
                  Scarica una copia di tutti i tuoi dati in formato JSON (GDPR Art. 20)
                </p>
              </div>
            </div>
            <DataExportButton />
          </div>

          <div className="border-t my-4" />

          {/* Privacy Policy & Cookie Policy Links (Aruba LegalBlink) */}
          <div className="space-y-inner">
            <h3 className="font-medium">Documenti legali</h3>
            <div className="flex flex-col gap-siblings text-sm">
              <a
                href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/privacy-policy-per-siti-web-o-e-commerce-it"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              <a
                href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/condizioni-d'uso-del-sito-it"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Termini e Condizioni
              </a>
              <a
                href="https://app.legalblink.it/api/documents/697e24efc95cff002359012c/cookie-policy-it"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cookie Policy
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-inner">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle as="h2" className="text-destructive">Zona pericolosa</CardTitle>
          </div>
          <CardDescription>
            Azioni irreversibili che elimineranno permanentemente i tuoi dati
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-inner">
            <h3 className="font-medium">Elimina account</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Elimina permanentemente il tuo account e tutti i dati associati. Questa azione
              non può essere annullata.
            </p>
            <DeleteAccountDialog />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
