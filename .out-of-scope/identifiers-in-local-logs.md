# Identificativi nei log locali

I log di entro scrivono in console, per intero, gli identificativi che servono a diagnosticare: il percorso di una foto (`{uuid}/{timestamp}-{nome}.{ext}`), l'id di una lista. Non li riduciamo né li mascheriamo.

## Perché

Ridurre un identificativo nel log ha senso quando il log esce dal dispositivo. Qui non esce:

- `logError` e `logWarn` (`src/lib/safeLog.ts`) scrivono solo nella console del browser.
- Sentry non raccoglie la console: `beforeBreadcrumb` in `src/lib/sentry.ts` scarta i breadcrumb di categoria `console`, e gli errori che arrivano a Sentry hanno messaggi fissi.

E la console non mostra niente che l'utente non riceva già. `getFoods` legge `foods` con `select('*')`, e la RLS fa leggere le righe a ogni membro della lista: ogni `image_url`, compreso l'uuid di chi ha caricato la foto in una lista condivisa, arriva già nella risposta di rete che lo stesso browser mostra.

Il percorso intero è invece ciò che rende utile il log: dice quale oggetto del bucket è fallito. Toglierlo costerebbe la diagnosi per nascondere un dato già visibile.

```ts
// src/lib/storage.ts: il percorso si logga intero, ed è voluto (#230, #281)
logError(`Error creating signed URL for ${imagePath}:`, error)
```

Ciò che `safeLog.ts` toglie davvero resta tolto: i segreti, cioè token e JWT, che escono di rimbalzo dalle proprietà degli errori.

Vale anche per il caso gemello di `src/lib/invites.ts`, che scrive il `list_id`, e per il log della foto rimasta nel bucket in entro-mobile (#354).

## Quando si riapre

- Un log comincia a uscire dal dispositivo: un'integrazione che raccoglie la console, una telemetria nuova, un servizio di log remoto.
- Un log scrive un dato che l'utente non riceve già dall'API: l'email o il contenuto di un altro utente, un dato di un'altra lista.

## Richieste precedenti

- #281: «Il log di una firma fallita scrive in console il percorso intero della foto, con l'uuid dell'utente», nata dalla guida `privacy` di Modern Web Guidance durante la prova #263
