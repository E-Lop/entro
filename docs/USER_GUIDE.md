# Guida Utente - entro

**entro** ti aiuta a tenere traccia delle scadenze degli alimenti per ridurre gli sprechi alimentari.

---

## Indice

- [Primi Passi](#primi-passi)
- [Aggiungere Alimenti](#aggiungere-alimenti)
- [Gestire gli Alimenti](#gestire-gli-alimenti)
- [Filtri e Ricerca](#filtri-e-ricerca)
- [Vista Calendario](#vista-calendario)
- [Scansione Barcode](#scansione-barcode)
- [Installare l'App (PWA)](#installare-lapp-pwa)
- [Utilizzo Offline](#utilizzo-offline)
- [Domande Frequenti](#domande-frequenti)

---

## Primi Passi

### Creare un Account

1. Vai su https://entro-il.netlify.app
2. Clicca su "Crea account"
3. Inserisci la tua email e una password (minimo 6 caratteri)
4. Controlla la tua email per il link di conferma
5. Clicca il link per attivare l'account

### Accedere

1. Vai su https://entro-il.netlify.app/login
2. Inserisci email e password
3. Clicca "Accedi"

---

## Aggiungere Alimenti

### Metodo 1: Inserimento Manuale

1. Clicca il pulsante verde **"+ Alimento"** in alto a destra
2. Compila i campi:
   - **Nome**: nome dell'alimento (obbligatorio)
   - **Categoria**: seleziona dal menu (es. Latticini, Carne, Frutta)
   - **Scadenza**: data di scadenza (obbligatoria)
   - **Quantità**: numero e unità (es. 2 pz, 500 g)
   - **Posizione**: dove lo conservi (Frigo, Freezer, Dispensa)
   - **Note**: informazioni aggiuntive (opzionale)
   - **Foto**: scatta o carica una foto (opzionale)
3. Clicca **"Salva"**

### Metodo 2: Scansione Barcode

1. Clicca **"+ Alimento"**
2. Clicca **"Scansiona Barcode"**
3. Inquadra il codice a barre del prodotto con la fotocamera
4. L'app compilerà automaticamente i dati disponibili
5. Aggiungi la data di scadenza (non è sul barcode!)
6. Clicca **"Salva"**

---

## Gestire gli Alimenti

### Modificare un Alimento

**Su Desktop:**
- Clicca il pulsante **"Modifica"** sulla card dell'alimento

**Su Mobile:**
- Fai uno **swipe verso destra** sulla card dell'alimento
- Oppure tocca la card e poi "Modifica"

### Eliminare un Alimento

**Su Desktop:**
- Clicca il pulsante **"Elimina"** sulla card
- Conferma l'eliminazione

**Su Mobile:**
- Fai uno **swipe verso sinistra** sulla card dell'alimento
- Conferma l'eliminazione

### Capire i Colori

Le card degli alimenti hanno un bordo colorato che indica l'urgenza:

| Colore | Significato |
|--------|-------------|
| 🟢 Verde | Più di 7 giorni alla scadenza |
| 🟡 Giallo | 4-7 giorni alla scadenza |
| 🟠 Arancione | 1-3 giorni alla scadenza |
| 🔴 Rosso | Scaduto |

---

## Filtri e Ricerca

### Usare i Filtri

1. Clicca su **"Filtri e Ricerca"** per espandere
2. Puoi filtrare per:
   - **Categoria**: es. solo Latticini
   - **Posizione**: es. solo Frigo
   - **Stato**: In scadenza, Scaduti
3. Usa la **barra di ricerca** per cercare per nome

### Filtri Rapidi

Clicca sulle **card statistiche** in alto:
- **"Totali"**: mostra tutti gli alimenti
- **"In scadenza"**: mostra solo quelli che scadono entro 3 giorni
- **"Scaduti"**: mostra solo quelli già scaduti

---

## Vista Calendario

### Passare alla Vista Calendario

1. Clicca su **"Calendario"** (accanto a "Lista")
2. Vedrai una vista settimanale con 7 giorni

### Navigare il Calendario

- **Su mobile**: scorri orizzontalmente per vedere altri giorni
- **Su desktop**: tutti i 7 giorni sono visibili

### Interagire con gli Alimenti

- Clicca su un alimento nel calendario per modificarlo
- Il badge su ogni giorno mostra quanti alimenti scadono

---

## Scansione Barcode

### Come Funziona

1. La scansione legge il codice EAN-13 del prodotto
2. Cerca le informazioni su Open Food Facts (database pubblico)
3. Compila automaticamente: nome, categoria, posizione suggerita

### Cosa NON Può Fare

- **Non legge la data di scadenza**: devi inserirla manualmente
- **Non tutti i prodotti sono nel database**: alcuni prodotti potrebbero non essere riconosciuti

### Suggerimenti

- Assicurati di avere buona illuminazione
- Tieni il barcode ben inquadrato e fermo
- Se un prodotto non viene riconosciuto, inseriscilo manualmente

---

## Installare l'App (PWA)

**entro** può essere installata come un'app sul tuo dispositivo per un accesso più rapido.

### Su iPhone (Safari)

1. Apri https://entro-il.netlify.app in **Safari**
2. Tocca l'icona **Condividi** (quadrato con freccia verso l'alto)
3. Scorri e seleziona **"Aggiungi alla schermata Home"**
4. Dai un nome all'app e tocca **"Aggiungi"**

### Su Android (Chrome)

1. Apri https://entro-il.netlify.app in **Chrome**
2. Tocca i **tre puntini** (⋮) in alto a destra
3. Seleziona **"Installa app"** o **"Aggiungi a schermata Home"**
4. Conferma l'installazione

### Su Computer (Chrome/Edge)

1. Apri il sito nel browser
2. Cerca l'icona di **installazione** (⊕) nella barra degli indirizzi
3. Clicca e conferma **"Installa"**

### Vantaggi dell'Installazione

- Accesso rapido dalla schermata home
- Si apre a schermo intero (senza barra del browser)
- Icona dedicata con il logo entro

---

## Utilizzo Offline

### Cosa Funziona Offline

| Funzionalità | Disponibile Offline |
|--------------|---------------------|
| Aprire l'app | ✅ Sì |
| Vedere l'interfaccia | ✅ Sì |
| Banner "Sei offline" | ✅ Sì |

### Cosa NON Funziona Offline

| Funzionalità | Disponibile Offline |
|--------------|---------------------|
| Vedere i tuoi alimenti | ❌ No |
| Aggiungere alimenti | ❌ No |
| Modificare/eliminare | ❌ No |
| Scansione barcode | ❌ No |
| Login/Logout | ❌ No |

### Perché?

I tuoi dati sono salvati in modo sicuro nel cloud (Supabase). Quando sei offline, l'app non può comunicare con il server per recuperare o salvare i dati.

### Cosa Vedere Quando Sei Offline

Vedrai un **banner arancione** in cima alla pagina con il messaggio:
> "Sei offline - alcune funzionalità potrebbero non essere disponibili"

Quando torni online, il banner scompare automaticamente e puoi usare tutte le funzionalità.

---

## Domande Frequenti

### Come cambio la mia password?

Attualmente non è possibile cambiare la password dall'app. Contatta il supporto.

### Posso condividere la mia lista con altri?

Questa funzionalità è pianificata per una versione futura.

### I miei dati sono al sicuro?

Sì, i tuoi dati sono:
- Salvati su server sicuri (Supabase)
- Accessibili solo con il tuo account
- Le immagini sono protette con URL temporanei

### Perché il barcode non riconosce il mio prodotto?

Il database Open Food Facts è mantenuto dalla comunità. Alcuni prodotti, specialmente quelli locali o nuovi, potrebbero non essere presenti. Puoi inserire l'alimento manualmente.

### Come disinstallo l'app?

- **iPhone/Android**: tieni premuta l'icona e seleziona "Elimina" o "Disinstalla"
- **Computer**: vai nelle impostazioni di Chrome → App → Gestisci app → Disinstalla

---

## Supporto

Per segnalare problemi o suggerire miglioramenti:
- Repository GitHub: https://github.com/E-Lop/entro

---

*Ultimo aggiornamento: 14 gennaio 2026*
