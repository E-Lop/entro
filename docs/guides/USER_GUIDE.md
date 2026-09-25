# Guida Utente - entro

**entro** ti aiuta a tenere traccia delle scadenze degli alimenti per ridurre gli sprechi alimentari.

Questa è la guida da leggere su GitHub, senza installare l'app. Dentro l'app la stessa guida è su [entroapp.it/guida](https://entroapp.it/guida): le due hanno le stesse sezioni, nello stesso ordine, e un test del repo lo controlla. Solo qui ci sono l'indice, i primi passi e i contatti.

---

## Indice

- [Primi passi](#primi-passi)
- [Aggiungere alimenti](#aggiungere-alimenti)
- [Gestire gli alimenti](#gestire-gli-alimenti)
- [Filtri e ricerca](#filtri-e-ricerca)
- [Vista calendario](#vista-calendario)
- [Condividere la lista](#condividere-la-lista)
- [Notifiche di scadenza](#notifiche-di-scadenza)
- [Scansione barcode](#scansione-barcode)
- [Feedback aptico](#feedback-aptico)
- [Installare l'app](#installare-lapp)
- [Utilizzo offline](#utilizzo-offline)
- [Domande frequenti](#domande-frequenti)

---

## Primi passi

### Creare un account

1. Vai su https://entroapp.it
2. Nella pagina di accesso, sotto il modulo, clicca **"Registrati"**
3. Inserisci nome, email e una password che contenga:
   - Minimo 8 caratteri
   - Almeno una lettera maiuscola (A-Z)
   - Almeno una lettera minuscola (a-z)
   - Almeno un numero (0-9)
   - Almeno un carattere speciale (!@#$%^&*...)
4. Ripeti la password in **"Conferma Password"**, accetta i termini e clicca **"Registrati"**
5. Controlla la tua email per il link di conferma (arriva da `noreply@entroapp.it`)
6. Clicca il link per attivare l'account

Se hai ricevuto un codice invito, vedi [Accettare un invito](#accettare-un-invito): con il codice, alla registrazione entri direttamente nella lista di chi ti ha invitato.

### Accedere

1. Vai su https://entroapp.it/login
2. Inserisci email e password
3. Clicca **"Accedi"**

### Password dimenticata

1. Vai alla pagina di accesso: https://entroapp.it/login
2. Clicca **"Password dimenticata?"** sotto il modulo
3. Inserisci la tua **email** registrata
4. Clicca **"Invia link di reset"**
5. Controlla la tua **casella email** (anche spam/posta indesiderata): l'email arriva da `noreply@entroapp.it`
6. Clicca il **link nell'email**
7. Scrivi la **nuova password** due volte, con le stesse regole della registrazione
8. Clicca **"Aggiorna password"**: dopo un secondo e mezzo sei nella dashboard

**Note**:
- Il link di reset vale per un tempo limitato; se è scaduto, chiedine un altro
- Se non ricevi l'email, controlla lo spam e che il mittente `noreply@entroapp.it` non sia bloccato

---

## Aggiungere alimenti

### Inserimento manuale

1. Tocca il pulsante per aggiungere un alimento: su smartphone è il **pulsante verde tondo in basso a destra**, su computer il pulsante **"+ Alimento"** in alto a destra
2. Il modulo si apre sulla sezione **"Dati alimento"**:
   - **Nome** (obbligatorio)
   - **Categoria**: es. Latticini, Carne, Frutta
   - **Posizione**: Frigo, Freezer o Dispensa
   - **Scadenza** (obbligatoria)
   - **Quantità**: numero e unità (es. 2 pz, 500 g), facoltativa
3. Per aggiungere foto o note, tocca **"Dettagli aggiuntivi"**: la sezione dei dati si chiude e si apre quella dei dettagli
4. Clicca **"Aggiungi alimento"**, sempre visibile in basso

Quando scegli la categoria, la posizione si compila da sola: Latticini va in frigo, Surgelati in freezer, Pane e Pasta in dispensa. Se la posizione l'hai già scelta tu, la categoria non la cambia. Vale per gli alimenti nuovi: in modifica la posizione resta quella salvata.

Se chiudi il modulo dopo averci scritto qualcosa (con Esc, cliccando fuori o sulla X), l'app chiede **"Scartare le modifiche?"**. **"Annulla"** ti riporta al modulo com'era, **"Scarta"** lo chiude e perde quello che hai scritto. Se invece ricarichi la pagina, l'avviso è quello del browser.

Se salvi senza un campo obbligatorio, si riapre la sezione che lo contiene.

### Scansione barcode

1. Apri il modulo con il pulsante tondo **+** (su computer **"+ Alimento"**)
2. Clicca **"Scansiona Barcode"**
3. Inquadra il codice a barre con la fotocamera
4. L'app compila nome, categoria e posizione, la quantità se è scritta sulla confezione, e nelle note la marca
5. Aggiungi la **data di scadenza**, che il codice a barre non contiene, e controlla il resto
6. Clicca **"Aggiungi alimento"**

---

## Gestire gli alimenti

### Modificare la quantità (veloce)

**Su mobile:**
- Fai uno **swipe verso destra** sulla card: si apre l'**editor rapido della quantità** direttamente sulla card
- Usa i pulsanti **−** / **+** oppure tocca il numero per digitarlo (il passo si adatta all'unità: 1 per pezzi e confezioni, 0,1 per kg e l, 10 per g e ml)
- La modifica si salva da sola, anche offline. Resta uno **spicchio** della card a destra: toccalo o fai swipe indietro per richiuderla; anche scorrere la lista la richiude

**Su desktop:**
- Clicca **"Modifica"** sulla card e cambia la quantità nel modulo

### Modificare tutto il resto

**Su mobile:**
- Nell'editor rapido tocca **"Modifica completa"** per aprire il modulo con nome, scadenza, unità, categoria, note e foto
- Oppure usa il menu **⋮** della card e scegli **"Modifica"**

**Su desktop:**
- Clicca **"Modifica"** sulla card

### Eliminare

**Su mobile:**
- Fai uno **swipe verso sinistra** sulla card, oppure menu **⋮** e **"Elimina"**

**Su desktop:**
- Clicca **"Elimina"** sulla card

L'app chiede **"Com'è finita?"** e propone tre risposte:

- **"L'ho consumato"**: l'hai mangiato o usato
- **"L'ho buttato"**: è finito nella spazzatura
- **"Toglilo e basta"**: l'avevi inserito per sbaglio, e non conta né come consumato né come buttato

In tutti e tre i casi l'alimento esce dalla lista e la sua foto viene cancellata: la foto non si recupera. **"Annulla"** lascia tutto com'era.

### Il menu ⋮ su telefono

Sotto i 640 px di larghezza le card non hanno i pulsanti in basso: al loro posto c'è **⋮** in alto a destra, con **"Modifica"** ed **"Elimina"**. Fa le stesse cose degli swipe. Con VoiceOver o TalkBack è la strada da usare, perché gli swipe sulla card non sono raggiungibili da uno screen reader.

### Stato di scadenza

Ogni card mostra un'etichetta con un colore e un testo, così lo stato si legge anche senza distinguere i colori:

| Etichetta | Colore | Significato |
|-----------|--------|-------------|
| «10 giorni» | Verde | Manca più di una settimana alla scadenza |
| «3 giorni» | Ambra | Scade entro 7 giorni: consumalo presto |
| «Scade oggi» | Rosso | Scade in giornata |
| «Scaduto» | Rosso | La data di scadenza è già passata |

---

## Filtri e ricerca

### Usare i filtri

1. Clicca **"Filtri e Ricerca"** per aprire il pannello
2. Puoi filtrare per:
   - **Categoria**: es. solo Latticini
   - **Posizione**: es. solo Frigo
   - **Scadenza**: **"Non scaduti"**, **"In scadenza (7gg)"** o **"Scaduti"**
3. Usa **"Cerca per nome"** per cercare un alimento

Con almeno un filtro attivo compare **"Cancella"**, che li toglie tutti insieme.

### Ordinare la lista

Nello stesso pannello, **"Ordina per"** mette gli alimenti in ordine di scadenza (prima i prossimi o prima i lontani), di nome (A-Z o Z-A) o di data di aggiunta (prima i recenti o prima i vecchi). Si parte dalla scadenza più vicina.

### Filtri rapidi

Clicca le **card statistiche** in alto:
- **"Totali"**: tutti gli alimenti
- **"In scadenza"**: quelli che scadono entro 7 giorni, oggi compreso
- **"Scaduti"**: quelli già scaduti

I filtri rapidi funzionano anche offline. Il numero sulla card e la lista filtrata vengono dagli stessi dati in cache, quindi coincidono.

---

## Vista calendario

Clicca **"Calendario"** (accanto a "Lista") per vedere le scadenze come agenda della settimana: i prossimi 7 giorni, uno sotto l'altro.

- I giorni sono in ordine dall'alto: **"Oggi"**, **"Domani"**, poi il resto della settimana. Scorri in **verticale** per vederli tutti.
- Ogni giorno mostra **quanti alimenti scadono** e con quale **urgenza** (oggi in rosso, i giorni successivi in ambra).
- I giorni senza scadenze restano visibili come riga "nessuna scadenza", così vedi dove si concentrano le scadenze.
- Tocca un alimento (o selezionalo da tastiera) per modificarlo.

---

## Condividere la lista

Puoi condividere la tua lista con familiari, coinquilini o partner: tutti vedono e gestiscono gli stessi alimenti.

### Invitare qualcuno

1. Clicca il **menu utente** in alto a destra e scegli **"Inviti"**
2. Seleziona **"Crea invito"**
3. Clicca **"Genera codice invito"**: ricevi un **codice di 6 caratteri** (es. `ABC123`) e il link che lo contiene (es. `https://entroapp.it/join/ABC123`)
4. Mandali con **"Condividi"** (WhatsApp, Telegram, SMS, email…) o copia il codice con **"Copia"**

### Accettare un invito

**Hai già un account:**
- Apri il link ricevuto e clicca **"Unisciti"**
- Oppure dal menu utente scegli **"Inviti"** → **"Accetta invito"**, scrivi il codice e clicca **"Continua"**

**Non hai un account:**
- Il link apre la registrazione con il codice già inserito
- Senza link, vai su https://entroapp.it/signup, clicca **"Ho un codice invito"**, scrivi il codice e clicca **"Verifica"**
- Completa la registrazione come in [Creare un account](#creare-un-account) e conferma l'email: sei già nella lista di chi ti ha invitato

### Se hai già una lista

Si appartiene a una lista sola. Accettando un invito lasci quella in cui sei, e l'app te lo dice prima di farlo:

- **Se eri l'unico membro**, la tua lista viene eliminata insieme ai suoi alimenti. L'avviso dice quanti sono
- **Se la lista era condivisa**, ne esci e gli alimenti restano agli altri membri

Per procedere clicca **"Conferma e unisciti"**. Non si torna indietro.

### Abbandonare una lista condivisa

Dal menu utente scegli **"Inviti"** → **"Abbandona lista condivisa"**, poi **"Abbandona lista"**. La voce c'è solo se sei in una lista con altri. Ti ritrovi con una lista personale vuota; gli altri membri tengono la lista e i suoi alimenti. Per rientrare serve un nuovo invito.

### Come funziona

- Tutti i membri vedono gli stessi alimenti in tempo reale
- Ognuno può aggiungere, modificare ed eliminare alimenti
- Non ci sono copie separate: la lista è una sola

### Domande frequenti

**Posso invitare più persone?**
Sì. Ogni codice vale una volta sola: genera un codice per ogni persona.

**Il codice invito è legato a un'email?**
No. Entra chi lo usa per primo, quindi mandalo solo a persone di cui ti fidi.

**L'invito scade?**
Sì, dopo 7 giorni dalla creazione. Poi serve un codice nuovo.

**Posso annullare un invito?**
No: un codice generato resta valido finché qualcuno lo usa o finché scade.

**Posso vedere chi è nella lista, o togliere qualcuno?**
Non ancora: non c'è un elenco dei membri, e non si può togliere nessuno.

---

## Notifiche di scadenza

Entro può inviarti notifiche push per avvisarti quando i tuoi alimenti stanno per scadere.

### Attivare le notifiche

1. Vai in **Impostazioni** (icona utente in alto a destra)
2. Nella sezione **Notifiche**, premi **"Attiva"**
3. Consenti le notifiche quando il browser lo chiede

### Personalizzare gli avvisi

- **Quando avvisarti**: scegli quanti giorni prima della scadenza ricevere l'avviso (7, 3, 2, 1 giorni prima o il giorno stesso)
- **Ore silenziose**: imposta una fascia oraria in cui non ricevere notifiche
- **Limite giornaliero**: decidi quante notifiche ricevere al massimo ogni giorno

### Quando arrivano

Le notifiche vengono inviate ogni giorno alle **10:00 (ora italiana)**. Riceverai un unico avviso che raggruppa tutti gli alimenti in scadenza secondo le tue preferenze.

### Note importanti

- **iPhone**: le notifiche push funzionano **solo** con l'app installata sulla schermata Home, non dal browser Safari
- **Ogni dispositivo va attivato separatamente**: se usi entro su più dispositivi, attiva le notifiche su ognuno
- Le notifiche funzionano anche quando il browser è chiuso
- Per disattivarle, premi "Disattiva" nelle impostazioni

---

## Scansione barcode

### Come funziona

1. La scansione legge il codice a barre del prodotto
2. Cerca le informazioni su Open Food Facts (database pubblico)
3. Compila il nome e la categoria. La posizione segue la categoria, come nell'inserimento manuale, a meno che tu non l'abbia già scelta
4. Se la confezione dichiara un peso o un volume (es. 500 g), compila anche la quantità
5. Nelle note scrive la marca e le categorie di Open Food Facts; puoi cancellarle o cambiarle prima di salvare

### Limiti

- **Non legge la data di scadenza**: va inserita a mano
- **Non tutti i prodotti sono nel database**: se un prodotto non viene riconosciuto, inseriscilo a mano
- Serve buona illuminazione, e il codice a barre va tenuto fermo e ben inquadrato

---

## Feedback aptico

Dove il browser sa far vibrare il telefono (Android), entro vibra quando uno swipe arriva alla soglia, quando salvi un alimento e quando lo togli dalla lista. Su iPhone e su computer il browser non lo permette.

Per spegnerlo o riaccenderlo vai in **Impostazioni**, sezione **"Feedback aptico"**. La sezione c'è solo sui dispositivi che vibrano.

---

## Installare l'app

**entro** si installa come un'app, senza passare da uno store. Installata si apre a schermo intero dalla sua icona, tiene i dati offline senza limiti di tempo e, su iPhone, è l'unico modo per ricevere le notifiche: da Safari senza installazione i dati in cache si cancellano dopo 7 giorni di non utilizzo.

### iPhone (Safari)

1. Apri https://entroapp.it in **Safari**
2. Tocca l'icona **Condividi** (quadrato con freccia verso l'alto)
3. Scorri e seleziona **"Aggiungi alla schermata Home"**
4. Dai un nome all'app e tocca **"Aggiungi"**

### Android (Chrome)

1. Apri https://entroapp.it in **Chrome**
2. Tocca i **tre puntini** (⋮) in alto a destra
3. Seleziona **"Installa app"** o **"Aggiungi a schermata Home"**
4. Conferma l'installazione

### Computer (Chrome/Edge)

1. Apri il sito nel browser
2. Cerca l'icona di **installazione** (⊕) nella barra degli indirizzi
3. Clicca e conferma **"Installa"**

---

## Utilizzo offline

Entro funziona anche senza connessione, ma quanto bene dipende da come lo usi.

### Con l'app installata (consigliato)

| Funzionalità | Offline | Note |
|--------------|---------|------|
| Vedere i tuoi alimenti | ✅ Sì | Dalla cache locale, **senza limiti di tempo** |
| Cercare e filtrare | ✅ Sì | Sui dati in cache |
| Vista calendario | ✅ Sì | Dalla cache locale |
| Aggiungere alimenti | ✅ Sì | Sincronizzato al ritorno online |
| Modificare alimenti | ✅ Sì | Sincronizzato al ritorno online |
| Eliminare alimenti, con il loro esito | ✅ Sì | Sincronizzato al ritorno online |
| Notifiche push | ✅ Sì | Su tutti i dispositivi, incluso iPhone |

### Da browser mobile (senza installare)

- **Android (Chrome)**: l'offline funziona come con l'app installata, incluse le notifiche push.
- **iPhone (Safari)**: puoi consultare i dati in cache, con limiti importanti:
  - Safari **cancella i dati salvati** dopo **7 giorni di non utilizzo**
  - Le notifiche push **non funzionano** da Safari
  - Le modifiche offline potrebbero non essere salvate in modo affidabile

> **Consiglio**: installa l'app sulla schermata Home. Su iPhone evita la perdita dei dati in cache e abilita le notifiche.

### Cosa funziona sempre offline

- Vedere alimenti, scadenze, filtri e calendario
- Aggiungere, modificare ed eliminare alimenti, anche più di uno di seguito
- Scattare o scegliere una foto, in un alimento nuovo o in uno che stai modificando: resta sul dispositivo e si carica quando torna la rete
- Uscire con **"Disconnetti"**: esci da questo dispositivo, gli altri su cui hai fatto l'accesso restano collegati

Un alimento che ha già una modifica in attesa non si può modificare né togliere di nuovo finché quella non arriva al server: il dialogo lo dice.

### Non disponibile offline

| Funzionalità | Motivo |
|--------------|--------|
| Attivazione notifiche push | Richiede registrazione sul server |
| Modifica preferenze notifiche | Richiede salvataggio sul server |
| Gestione liste condivise e inviti (creare, accettare, abbandonare) | Richiede comunicazione con il server |
| Esportazione dati | Richiede recupero dati dal server |
| Scansione barcode | Richiede connessione a Open Food Facts |
| Accesso | Per entrare serve la rete |

### Quando torni online

1. **Offline**, in cima alla pagina c'è un banner ambra, **"Sei offline"**, con il numero di modifiche in attesa (es. "2 modifiche in attesa di sincronizzazione").
2. **Quando torna la rete** le modifiche partono da sole, nell'ordine in cui le hai fatte, e il banner diventa verde con **"Sincronizzazione in corso..."**.
3. **Finito l'invio** il banner sparisce e i dati sono aggiornati.

---

## Domande frequenti

### Come cambio la mia password?

1. Dal menu utente premi **"Disconnetti"**
2. Nella pagina di accesso clicca **"Password dimenticata?"**
3. Segui il link che ricevi per email e scegli la nuova password

I passaggi completi sono in [Password dimenticata](#password-dimenticata).

### I miei dati sono al sicuro?

Sì, i tuoi dati sono:
- Salvati su server sicuri (Supabase)
- Accessibili solo con il tuo account
- Le immagini sono protette con URL temporanei

### Perché il barcode non riconosce il mio prodotto?

Il database Open Food Facts è mantenuto dalla comunità. Alcuni prodotti, specialmente quelli locali o nuovi, potrebbero non essere presenti. Puoi inserire l'alimento a mano.

### Cosa succede se la foto non si carica?

Compare "La foto non è stata caricata. Riprova." e il modulo resta aperto, con la foto ancora dentro: l'alimento non è stato salvato. Premi di nuovo il pulsante di salvataggio, oppure togli la foto e salva senza.

### Perché non ricevo le notifiche su iPhone?

Su iPhone le notifiche push funzionano solo se hai installato l'app sulla schermata Home. Apri entroapp.it in Safari, tocca **Condividi** e poi **"Aggiungi alla schermata Home"**. Dopo l'installazione, attiva le notifiche dalle impostazioni dell'app.

### Perché offline non vedo i miei dati su iPhone?

Se usi entro da Safari senza installarlo, iOS cancella i dati in cache dopo 7 giorni di non utilizzo. Installa l'app sulla schermata Home per avere i dati sempre disponibili offline.

### Come disinstallo l'app?

- **iPhone/Android**: tieni premuta l'icona e seleziona "Elimina" o "Disinstalla"
- **Computer**: vai nelle impostazioni di Chrome → App → Gestisci app → Disinstalla

---

## Supporto

Per segnalare problemi, suggerire miglioramenti o chiedere aiuto:
- Email: [support@entroapp.it](mailto:support@entroapp.it)
- Repository GitHub: https://github.com/E-Lop/entro

---

*Ultimo aggiornamento: 25 settembre 2026*
