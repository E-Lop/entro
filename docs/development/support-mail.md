# Email di supporto

## Configurazione

- **Email**: `support@entroapp.it`
- **Tipo**: alias/redirect configurato su Aruba verso l'email personale dello sviluppatore
- **Pannello**: gestione dominio entroapp.it su Aruba

## Implementazione nell'app

- **File**: `src/pages/SettingsPage.tsx`
- **Posizione**: sezione "Supporto" tra Notifiche e Privacy & Dati
- **Meccanismo**: `<a href="mailto:support@entroapp.it">` — funziona nativamente su Android, iOS e desktop
- **Data deploy**: 2026-03-05
- **Verificato su**: Android, iOS

## Risposte in uscita

L'alias/redirect Aruba inoltra solo la posta **in arrivo** verso Gmail. Quando si risponde da Gmail, il mittente è l'indirizzo Gmail personale, non `support@entroapp.it`.

### Opzioni per rispondere come support@entroapp.it

1. **Casella vera su Aruba + Gmail "Invia posta come"**
   - Creare `support@entroapp.it` come mailbox (non solo redirect) dal pannello Aruba
   - Gmail → Impostazioni → Account e importazione → "Invia messaggio come" → Aggiungi
   - SMTP: `smtps.aruba.it`, porta `465` (SSL), credenziali della casella Aruba

2. **Servizio email gratuito** (Zoho Mail, ImprovMX)
   - Collegare il dominio al servizio
   - Configurare Gmail per inviare tramite il loro SMTP

3. **Google Workspace** — gestione nativa del dominio da Gmail (a pagamento)

### Scelta attuale

Per il volume attuale di email, si risponde direttamente da Gmail. Accettabile per un progetto personale.

## Note

- La stessa email è usata come `VAPID_SUBJECT` (`mailto:support@entroapp.it`) per le push notifications
- Non servono librerie aggiuntive: il tag `mailto:` è supportato da tutti i browser e client nativi
