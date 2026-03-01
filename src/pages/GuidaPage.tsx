import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  ScanBarcode,
  Pencil,
  Trash2,
  Palette,
  Search,
  Calendar,
  Users,
  Share2,
  Bell,
  Smartphone,
  WifiOff,
  CircleHelp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export function GuidaPage() {
  useDocumentMeta('Guida')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button asChild variant="ghost" className="min-h-[44px] -ml-2 gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Torna alla dashboard
        </Link>
      </Button>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Guida Utente</h1>
        <p className="text-muted-foreground mt-2">
          Tutto quello che serve per usare entro al meglio
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            Aggiungere Alimenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Inserimento manuale</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Premi il pulsante verde <strong className="text-foreground">"+ Alimento"</strong> in alto a destra</li>
              <li>Compila i campi: nome, categoria, scadenza, quantità, posizione</li>
              <li>Opzionalmente aggiungi note e una foto</li>
              <li>Premi <strong className="text-foreground">"Salva"</strong></li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <ScanBarcode className="h-4 w-4" />
              Scansione barcode
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Premi <strong className="text-foreground">"+ Alimento"</strong></li>
              <li>Premi <strong className="text-foreground">"Scansiona Barcode"</strong></li>
              <li>Inquadra il codice a barre con la fotocamera</li>
              <li>L'app compilerà automaticamente i dati disponibili</li>
              <li>Aggiungi la data di scadenza (non è sul barcode!) e salva</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            Gestire gli Alimenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Modificare</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Mobile:</strong> swipe verso destra sulla card</li>
              <li><strong className="text-foreground">Desktop:</strong> clicca il pulsante "Modifica"</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Eliminare
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Mobile:</strong> swipe verso sinistra sulla card</li>
              <li><strong className="text-foreground">Desktop:</strong> clicca il pulsante "Elimina"</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Colori scadenza
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-muted-foreground">Verde: 7+ giorni</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Giallo: 4-7 giorni</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-500" />
                <span className="text-muted-foreground">Arancione: 1-3 giorni</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Rosso: scaduto</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-600" />
            Filtri e Ricerca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Usare i filtri</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Premi <strong className="text-foreground">"Filtri e Ricerca"</strong> per espandere</li>
              <li>Filtra per categoria (es. Latticini), posizione (es. Frigo) o stato</li>
              <li>Usa la barra di ricerca per cercare per nome</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Filtri rapidi</h3>
            <p className="text-sm text-muted-foreground">
              Tocca le card statistiche in alto per filtrare rapidamente:
              {' '}<strong className="text-foreground">"Totali"</strong>,
              {' '}<strong className="text-foreground">"In scadenza"</strong> (entro 7 giorni),
              {' '}<strong className="text-foreground">"Scaduti"</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Vista Calendario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Premi <strong className="text-foreground">"Calendario"</strong> (accanto a "Lista") per passare alla vista settimanale.</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-foreground">Mobile:</strong> scorri orizzontalmente per navigare i giorni</li>
            <li><strong className="text-foreground">Desktop:</strong> tutti i 7 giorni sono visibili</li>
            <li>Tocca un alimento nel calendario per modificarlo</li>
            <li>Il badge su ogni giorno mostra quanti alimenti scadono</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            Condividere la Lista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Invitare qualcuno
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Apri il menu utente in alto a destra</li>
              <li>Seleziona <strong className="text-foreground">"Invita membro"</strong></li>
              <li>Genera un codice invito di 6 caratteri</li>
              <li>Condividi il codice via WhatsApp, Telegram, SMS o email</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Accettare un invito</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Link diretto:</strong> clicca il link ricevuto (es. entroapp.it/join/ABC123)</li>
              <li><strong className="text-foreground">Codice manuale:</strong> in fase di registrazione, premi "Ho un codice invito" e inserisci il codice</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Come funziona</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Tutti i membri vedono gli stessi alimenti in tempo reale</li>
              <li>Ognuno può aggiungere, modificare ed eliminare alimenti</li>
              <li>Le modifiche sono sincronizzate immediatamente</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Domande frequenti</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Puoi generare più codici invito per la stessa lista</li>
              <li>I codici scadono dopo 7 giorni</li>
              <li>Un utente può appartenere a una sola lista alla volta</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-orange-600" />
            Notifiche Scadenza
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Attivare le notifiche</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Vai in <strong className="text-foreground">Impostazioni</strong> (icona utente in alto a destra)</li>
              <li>Nella sezione <strong className="text-foreground">Notifiche</strong>, premi <strong className="text-foreground">"Attiva"</strong></li>
              <li>Consenti le notifiche quando il browser lo chiede</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Personalizzare gli avvisi</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Quando avvisarti:</strong> scegli quanti giorni prima della scadenza ricevere l'avviso (7, 3, 2, 1 giorni prima o il giorno stesso)</li>
              <li><strong className="text-foreground">Ore silenziose:</strong> imposta una fascia oraria in cui non ricevere notifiche</li>
              <li><strong className="text-foreground">Limite giornaliero:</strong> decidi quante notifiche ricevere al massimo ogni giorno</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Quando arrivano</h3>
            <p className="text-sm text-muted-foreground">
              Le notifiche vengono inviate ogni giorno alle 10:00 (ora italiana). Riceverai un unico avviso
              che raggruppa tutti gli alimenti in scadenza secondo le tue preferenze.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Note importanti</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">iPhone:</strong> le notifiche push funzionano solo con l'app installata sulla schermata Home, non dal browser Safari</li>
              <li><strong className="text-foreground">Ogni dispositivo va attivato separatamente:</strong> se usi entro su più dispositivi, attiva le notifiche su ognuno</li>
              <li>Le notifiche funzionano anche quando il browser è chiuso</li>
              <li>Per disattivarle, premi "Disattiva" nelle impostazioni</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-amber-600" />
            Scansione Barcode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Come funziona</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>La scansione legge il codice EAN-13 del prodotto</li>
              <li>Cerca le informazioni su Open Food Facts (database pubblico)</li>
              <li>Compila automaticamente: nome, categoria, posizione suggerita</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Limiti</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Non legge la data di scadenza: va inserita manualmente</li>
              <li>Non tutti i prodotti sono nel database</li>
              <li>Serve buona illuminazione e il barcode deve essere ben inquadrato</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-pink-600" />
            Installare l'App
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">iPhone (Safari)</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Apri entroapp.it in Safari</li>
              <li>Tocca l'icona Condividi (quadrato con freccia verso l'alto)</li>
              <li>Seleziona <strong className="text-foreground">"Aggiungi alla schermata Home"</strong></li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Android (Chrome)</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Apri entroapp.it in Chrome</li>
              <li>Tocca i tre puntini in alto a destra</li>
              <li>Seleziona <strong className="text-foreground">"Installa app"</strong> o "Aggiungi a schermata Home"</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium mb-2">Computer (Chrome/Edge)</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Apri il sito nel browser</li>
              <li>Cerca l'icona di installazione nella barra degli indirizzi</li>
              <li>Clicca e conferma "Installa"</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-gray-600" />
            Utilizzo Offline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Entro funziona anche senza connessione internet, ma l'esperienza varia in base a come usi l'app.</p>

          <div>
            <h3 className="font-medium mb-2 text-foreground/80 flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Con l'app installata (consigliato)
            </h3>
            <p className="mb-1">Installando entro sulla schermata Home hai l'esperienza offline migliore:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>I tuoi dati restano in cache <strong className="text-foreground">senza limiti di tempo</strong></li>
              <li>Puoi aggiungere, modificare ed eliminare alimenti anche offline</li>
              <li>Le modifiche vengono sincronizzate automaticamente quando torni online</li>
              <li>Le notifiche push funzionano su tutti i dispositivi, incluso iPhone</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-foreground/80">Da browser mobile (senza installare)</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-foreground">Android (Chrome):</strong> l'offline funziona come con l'app installata, incluse le notifiche push
              </li>
              <li>
                <strong className="text-foreground">iPhone (Safari):</strong> puoi consultare i dati in cache, ma con limitazioni importanti:
                <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                  <li>Safari cancella i dati salvati dopo <strong className="text-foreground">7 giorni di non utilizzo</strong></li>
                  <li>Le notifiche push <strong className="text-foreground">non funzionano</strong> da Safari</li>
                  <li>Le modifiche offline potrebbero non essere salvate in modo affidabile</li>
                </ul>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3">
            <p className="text-foreground/80 font-medium text-xs">
              Per la migliore esperienza offline, installa l'app sulla schermata Home. Su iPhone è particolarmente importante per evitare la perdita dei dati in cache e abilitare le notifiche.
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-foreground/80">Cosa funziona sempre offline</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Visualizzare alimenti, scadenze, filtri e calendario</li>
              <li>Aggiungere, modificare ed eliminare alimenti (con sync automatica)</li>
              <li>Un banner ti mostra quante modifiche sono in attesa di sincronizzazione</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2 text-foreground/80">Non disponibile offline</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Attivazione notifiche push (richiede registrazione sul server)</li>
              <li>Scansione barcode (richiede connessione a Open Food Facts)</li>
              <li>Login e logout</li>
              <li>Caricamento nuove foto</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-sky-600" />
            Domande Frequenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Come cambio la mia password?</h3>
            <p className="text-sm text-muted-foreground">
              Fai logout, vai alla pagina di login e clicca "Password dimenticata?" per ricevere un'email di reset.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">I miei dati sono al sicuro?</h3>
            <p className="text-sm text-muted-foreground">
              Sì. I dati sono salvati su server sicuri, accessibili solo con il tuo account. Le immagini sono protette con URL temporanei.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Perché il barcode non riconosce il mio prodotto?</h3>
            <p className="text-sm text-muted-foreground">
              Il database Open Food Facts è mantenuto dalla comunità. Alcuni prodotti locali o nuovi potrebbero non essere presenti. Puoi inserire l'alimento manualmente.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Perché non ricevo le notifiche su iPhone?</h3>
            <p className="text-sm text-muted-foreground">
              Su iPhone le notifiche push funzionano solo se hai installato l'app sulla schermata Home.
              Apri entroapp.it in Safari, tocca Condividi e poi "Aggiungi alla schermata Home". Dopo l'installazione, attiva le notifiche dalle impostazioni dell'app.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Perché offline non vedo i miei dati su iPhone?</h3>
            <p className="text-sm text-muted-foreground">
              Se usi entro da Safari senza installarlo, iOS cancella i dati in cache dopo 7 giorni di non utilizzo.
              Installa l'app sulla schermata Home per avere i dati sempre disponibili offline.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Come disinstallo l'app?</h3>
            <p className="text-sm text-muted-foreground">
              Su iPhone/Android: tieni premuta l'icona e seleziona "Elimina". Su computer: impostazioni di Chrome &gt; App &gt; Gestisci &gt; Disinstalla.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default GuidaPage
