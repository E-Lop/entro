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
        <h1 className="text-3xl font-bold tracking-tight">Guida utente</h1>
        <p className="text-muted-foreground mt-2">
          Tutto quello che serve per usare entro al meglio
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-muted-foreground" />
            Aggiungere alimenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Inserimento manuale</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Tocca il pulsante per aggiungere un alimento: su smartphone è il <strong className="text-foreground">pulsante verde tondo in basso a destra</strong>, su computer il pulsante <strong className="text-foreground">"+ Alimento"</strong> in alto a destra</li>
              <li>Compila i dati nella sezione <strong className="text-foreground">"Dati alimento"</strong>: nome, categoria, posizione, scadenza e quantità</li>
              <li>Per aggiungere foto o note, tocca <strong className="text-foreground">"Dettagli aggiuntivi"</strong></li>
              <li>Premi <strong className="text-foreground">"Aggiungi alimento"</strong></li>
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-muted-foreground" />
            Gestire gli alimenti
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Modificare</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Mobile:</strong> swipe verso destra sulla card (vibrazione alla soglia)</li>
              <li><strong className="text-foreground">Desktop:</strong> clicca il pulsante "Modifica"</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Eliminare
            </h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li><strong className="text-foreground">Mobile:</strong> swipe verso sinistra sulla card (vibrazione alla soglia)</li>
              <li><strong className="text-foreground">Desktop:</strong> clicca il pulsante "Elimina"</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Il feedback aptico si può disattivare da Impostazioni &gt; Feedback Aptico.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Stato di scadenza
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ogni alimento mostra un'etichetta con il colore e il testo dello stato, così lo riconosci
              a colpo d'occhio anche senza distinguere i colori:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                  5 giorni
                </span>
                <span className="text-muted-foreground">Manca più di una settimana alla scadenza</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  3 giorni
                </span>
                <span className="text-muted-foreground">Scade entro 7 giorni: consumalo presto</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                  Scade oggi
                </span>
                <span className="text-muted-foreground">Scade in giornata</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="inline-flex shrink-0 items-center rounded-md border border-transparent bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
                  Scaduto
                </span>
                <span className="text-muted-foreground">La data di scadenza è già passata</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            Filtri e ricerca
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Vista calendario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Premi <strong className="text-foreground">"Calendario"</strong> (accanto a "Lista") per vedere le scadenze come agenda della settimana.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>I giorni sono in ordine dall'alto: <strong className="text-foreground">"Oggi"</strong>, <strong className="text-foreground">"Domani"</strong>, poi il resto della settimana. Scorri in verticale per vederli tutti.</li>
            <li>Ogni giorno mostra <strong className="text-foreground">quanti alimenti scadono</strong> e con quale urgenza (oggi in rosso, i giorni successivi in ambra).</li>
            <li>I giorni senza scadenze restano visibili come riga "nessuna scadenza", così vedi a colpo d'occhio dove si concentrano.</li>
            <li>Tocca un alimento (o selezionalo da tastiera) per modificarlo.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Condividere la lista
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
              <li>Seleziona <strong className="text-foreground">"Crea invito"</strong></li>
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifiche di scadenza
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <ScanBarcode className="h-5 w-5 text-muted-foreground" />
            Scansione barcode
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
            Installare l'app
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
          <CardTitle as="h2" className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-muted-foreground" />
            Utilizzo offline
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

          <div className="rounded-lg border border-success/30 bg-success/10 p-3">
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
              <li>Modifica preferenze notifiche (intervalli, ore silenziose, max giornaliere)</li>
              <li>Gestione liste condivise e inviti (creare, accettare, abbandonare)</li>
              <li>Esportazione dati</li>
              <li>Scansione barcode (richiede connessione a Open Food Facts)</li>
              <li>Login e logout</li>
              <li>Caricamento nuove foto</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-muted-foreground" />
            Domande frequenti
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
