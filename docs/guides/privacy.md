# Come entro implementa il GDPR

Questa pagina racconta cosa fa il codice di entro con i dati personali: cosa salva, dove, come si esporta e come si cancella. Non è la privacy policy e non ne fa le veci. La policy, i termini e la cookie policy stanno su LegalBlink, e l'app li linka dal footer e dalla pagina di registrazione:

- [Privacy Policy](https://app.legalblink.it/api/documents/697e24efc95cff002359012c/privacy-policy-per-siti-web-o-e-commerce-it)
- [Termini e Condizioni](https://app.legalblink.it/api/documents/697e24efc95cff002359012c/condizioni-d'uso-del-sito-it)
- [Cookie Policy](https://app.legalblink.it/api/documents/697e24efc95cff002359012c/cookie-policy-it)

Ogni affermazione qui sotto indica il file che la conferma. Se il codice cambia e la pagina no, ha ragione il codice.

## Cosa raccoglie

### Sul server (Supabase)

| Dato | Dove | Cosa contiene |
|---|---|---|
| Account | Supabase Auth (`auth.users`) | Email, password (la gestisce Supabase Auth, l'app non la salva), nome. Chi si registra con un codice invito lo manda nei metadati dell'account (`invite_code`), e il database lo usa per metterlo nella lista di chi l'ha invitato (`src/lib/auth.ts`, `supabase/migrations/20260925130000_signup_joins_invited_list.sql`). |
| Alimenti | tabella `foods` | Nome, quantità e unità, scadenza, categoria, luogo di conservazione, foto, codice a barre, note, esito e date. |
| Alimenti tolti | tabella `foods` | Togliere un alimento non cancella la riga: imposta `deleted_at` e, se l'utente sceglie un esito, `status` (`consumed` o `wasted`) e `consumed_at`. La foto invece viene cancellata dallo Storage (`softDeleteFood` in `src/lib/foods.ts`). |
| Foto | bucket Storage `food-images` | Un file per foto, nella cartella `{user_id}/` di chi l'ha caricata (`src/lib/storage.ts`). |
| Liste e membri | tabelle `lists`, `list_members` | Nome della lista, chi l'ha creata, chi ne fa parte e da quando. |
| Inviti | tabella `invites` | Codice di 6 caratteri, lista, chi l'ha creato, scadenza, stato; l'email dell'invitato se l'invito è per email (`email`), oppure (`pending_user_email`) se l'invitato si è registrato con il codice prima della versione 1.12.20, quando il codice arrivava dopo la registrazione con `register_pending_invite`. Da allora arriva nei metadati dell'account (vedi la riga «Account»). |
| Sottoscrizioni push | tabella `push_subscriptions` | Endpoint del servizio push del browser, le due chiavi della sottoscrizione, lo user agent del browser (`supabase/migrations/20260228_push_notifications.sql`, `src/lib/pushNotifications.ts`). |
| Preferenze di notifica | tabella `notification_preferences` | Attivazione, giorni di anticipo, ore silenziose, limite giornaliero, fuso orario, e i contatori degli invii del giorno. |

Le tabelle con i dati degli utenti hanno la RLS attiva: un utente legge e scrive le proprie righe e quelle delle liste di cui è membro.

### Nel browser

L'app non imposta cookie propri. Salva invece queste chiavi:

- **localStorage**: la sessione di Supabase (chiavi `sb-*`), il tema (`entro-theme`), il feedback aptico (`entro_haptics_enabled`), e dei segnali «già visto» per suggerimenti e avvisi (`entro_hasSeenSwipeHint`, `entro_hasSeenSwipeAnimation`, `entro_hasSeenInstructionCard`, `entro_notification_prompt_dismissed`, `show_welcome_toast`).
- **sessionStorage**: `explicit_auth`, `verify_email` (l'indirizzo appena registrato, per la pagina di verifica) e `user_initialized_<email>`.
- **IndexedDB**: la copia delle liste per l'uso offline (chiave `entro-react-query-cache`, `src/lib/queryPersister.ts`) e le foto scattate offline in attesa di caricamento (store `pending-images`, `src/lib/pendingImages.ts`).
- **Cache del service worker**: i file dell'app e le foto degli alimenti già viste, fino a 200 per 7 giorni (`supabase-images-cache` in `src/sw.ts`).

Il codice non contiene un banner dei cookie, né script di analytics o di tracciamento degli errori.

## Esportare i dati (art. 20)

Da **Impostazioni**, «Esporta i miei dati» scarica un file JSON (`entro-export-<timestamp>.json`) costruito nel browser (`src/lib/dataExport.ts`). Contiene:

- l'account: id, email, nome, data di registrazione;
- tutti gli alimenti che l'utente può leggere, compresi quelli tolti con il loro esito;
- la lista: id, nome, chi l'ha creata, e i membri con la data di ingresso.

Le foto sono nel file come link firmati validi **24 ore**: chi le vuole tenere le scarica entro quel tempo.

L'esportazione oggi non comprende le sottoscrizioni push né le preferenze di notifica.

## Cancellare l'account (art. 17)

Da **Impostazioni**, «Elimina account» chiede la password e la verifica con un nuovo accesso prima di toccare qualcosa (`src/components/settings/DeleteAccountDialog.tsx`). Poi:

1. Chiede al server se la lista dell'utente è condivisa (RPC `account_deletion_preview`). Se l'utente ne è l'unico membro, toglie dallo Storage le foto dei suoi alimenti (`src/lib/accountDeletion.ts`). Se non ci riesce si ferma: dopo la cancellazione nessuno potrebbe più toglierle.
2. Chiama la RPC `delete_user()`, che cancella l'utente da `auth.users`.
3. Il trigger `release_data_of_deleted_user` su `auth.users` decide cosa sparisce con lui (`supabase/migrations/20260922_shared_list_survives_account_deletion.sql`):
   - le liste di cui era l'unico membro, con tutti i loro alimenti, anche quelli tolti;
   - gli alimenti senza lista, righe personali di prima delle liste condivise;
   - gli inviti che aveva creato e quelli in attesa a suo nome.

   Una lista condivisa invece resta agli altri membri: gli alimenti che vi aveva creato restano senza autore, e le foto che quegli alimenti usano restano leggibili ai membri della lista.
4. Sottoscrizioni push e preferenze di notifica si cancellano a cascata con l'utente.
5. Nel browser l'app chiude la sessione locale, toglie le chiavi di sessione e la copia offline delle liste (`clearAuthStorage` in `src/lib/auth.ts`) e porta alla pagina di accesso (`/login`).

Il tema e i segnali «già visto» restano nel localStorage di quel browser: non contengono dati dell'account.

Il trigger sta su `auth.users`, e non dentro `delete_user()`, perché così vale anche per un utente cancellato dalla dashboard di Supabase o con l'API admin.

## Terze parti

| Servizio | Cosa riceve | Dove sta nel codice |
|---|---|---|
| Supabase | Tutti i dati della tabella sopra: database, autenticazione, Storage, Realtime ed Edge Functions. | `src/lib/supabase.ts`, `supabase/` |
| Netlify | Ospita l'app: serve i file della PWA a chi la apre. | `netlify.toml` |
| Servizi push dei browser | L'endpoint della sottoscrizione appartiene al servizio push del browser che l'utente usa. L'Edge Function `send-expiry-notifications` gli manda ogni mattina, se ci sono alimenti in scadenza, un messaggio con i loro nomi. | `supabase/functions/send-expiry-notifications/index.ts` |
| Open Food Facts | Il codice a barre scansionato, chiesto dal browser a `world.openfoodfacts.org`. Nessun dato dell'account. | `src/lib/openfoodfacts.ts` |
| Ko-fi | Il browser scarica l'immagine del pulsante da `storage.ko-fi.com`. Il pulsante è un link: nessun widget, e nessun pagamento passa dall'app. Compare solo se `VITE_KOFI_URL` è impostata. | `src/components/ui/KofiButton.tsx` |
| LegalBlink | Ospita privacy policy, termini e cookie policy. L'app ci porta solo con un link. | `src/components/layout/Footer.tsx`, `src/pages/SignUpPage.tsx` |
