# Domain docs — regole di consumo

> Scritto a mano, **non** generato da `/setup-matt-pocock-skills`: diverge dal template della skill su un punto sostanziale, cioè che in questo repo un `CONTEXT.md` non ci va. Se il setup viene rilanciato, questo file va conservato, non rigenerato dal seed.

## Prima di esplorare il codice, leggi il bundle

La fonte unica del dominio è il knowledge bundle OKF affiancato **`../entro-family/`**, consumato per riferimento da questo repo, da entro-mobile (Expo, stesso backend Supabase) e — per le sole `conventions/` — da farmakit.

- `../entro-family/core/index.md` — entità, categorie e shelf-life, ciclo di vita `FoodStatus`, `ExpiryStatus`, conservazione e unità.
- `../entro-family/conventions/index.md` — pattern d'ingegneria cross-prodotto, fra cui i GRANT espliciti della Data API che questo repo applica a ogni migrazione.

Si leggono i due indici, poi le pagine che toccano l'area su cui stai lavorando.

Se la cartella affiancata non c'è (un runner di CI, una macchina nuova), dillo invece di procedere a memoria: le regole non sono ricostruibili dal codice.

## Non creare `CONTEXT.md` in questo repo

La skill `domain-modeling` crea `CONTEXT.md` alla radice al primo termine risolto. Qui **non va fatto**: sarebbe un secondo glossario accanto a `core/`, e due glossari divergono. È già successo esattamente qui: il glossario di dominio viveva in questo repo, e il bundle è nato per smettere di tenerne una copia per client.

Un termine da risolvere o correggere si scrive **nel bundle**, in tre modifiche coordinate: la pagina in `core/` o `conventions/` col frontmatter OKF, la riga nell'`index.md` della cartella, la voce datata in cima a `log.md`. E `viewer/index.html` non si committa mai.

## Usa il vocabolario del bundle

Quando l'output nomina un concetto di dominio — titolo di una issue, nome di un test, ipotesi in una diagnosi — usa il termine come lo definisce il bundle, senza scivolare in sinonimi. La collisione fra `FoodStatus.active` («non concluso») e il valore `active` del filtro UI («non scaduto») è costata una rinomina a `FilterParams.expiry`: due insiemi diversi chiamati con la stessa parola.

Se il concetto che ti serve nel bundle non c'è, è un segnale: o stai inventando lingua che il progetto non parla, oppure c'è un buco vero e va colmato lì.

## Decisioni architetturali

- Vale per **più di un client** (schema Supabase, semantica del dominio, accessibilità, pattern d'ingegneria)? Non è un ADR locale: va in `../entro-family/conventions/` più la voce in `log.md`. È lì che entro-mobile la legge.
- Vale **solo per questo repo** (una scelta di Vite, del service worker, della PWA)? Allora `docs/adr/NNNN-slug.md` qui.

La barra resta quella della skill, e vanno superate tutte e tre: difficile da invertire, sorprendente senza contesto, esito di un compromesso vero. Se ne manca una, non è un ADR.

Sulla macchina di sviluppo `docs/superpowers/` (plans e specs fino a lug 2026, non versionato) è un **archivio storico** del set di skill precedente: si legge, non si estende e non si converte in ADR.
