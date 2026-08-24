# Issue tracker: GitHub

Le issue e le spec di questo repo vivono nelle **GitHub Issues** di `E-Lop/entro`. Tutte le operazioni passano dalla CLI `gh`, che deduce il repo da `git remote -v` quando gira dentro il clone.

## Operazioni

- **Creare**: `gh issue create --title "..." --body "..."` (per corpi multilinea, heredoc).
- **Leggere**: `gh issue view <numero> --comments`, prendendo anche le label.
- **Elencare**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, con i filtri `--label` / `--state` che servono.
- **Commentare**: `gh issue comment <numero> --body "..."`
- **Etichettare**: `gh issue edit <numero> --add-label "..."` / `--remove-label "..."`
- **Chiudere**: `gh issue close <numero> --comment "..."`

## La parola chiave che chiude una issue va in inglese

`Closes #42` / `Fixes` / `Resolves`. **`Chiude #42` non chiude niente**: GitHub riconosce solo le parole inglesi, e il resto del messaggio resta in italiano. Non è prosa, è un'interfaccia. Verificato sulla storia del repo: quattro issue sono rimaste aperte per due giorni col fix già mergiato e rilasciato. Sta anche nel `CONTRIBUTING.md`.

## Le PR non sono una superficie di triage

**PR come superficie di richiesta: no.** _(Mettere `sì` se le PR esterne vanno trattate come richieste; `/triage` legge questo flag.)_ Le PR qui nascono da issue già triagate, non viceversa.

Nota che GitHub usa **una sola numerazione** per issue e PR: un `#42` nudo può essere l'una o l'altra. Si risolve con `gh pr view 42` e ripiego su `gh issue view 42`.

## Quando una skill dice «pubblica sul tracker»

Creare una issue GitHub.

## Quando una skill dice «recupera il ticket»

`gh issue view <numero> --comments`.

## Convenzioni di questo repo

- Il lavoro simmetrico su entro-mobile (`E-Lop/entro-mobile`) va linkato nella issue: il backend Supabase è lo stesso e alcune correzioni sono gemelle sullo stesso file condiviso.

## Operazioni di wayfinding

Usate da `/wayfinder`. La **mappa** è una issue singola con le issue **figlie** come ticket.

- **Mappa**: issue con label `wayfinder:map`, che contiene Note / Decisioni-finora / Nebbia. `gh issue create --label wayfinder:map`.
- **Ticket figlio**: issue legata alla mappa come sub-issue (`gh api` sull'endpoint delle sub-issue). Dove le sub-issue non sono attive, si aggiunge il figlio a una task list nel corpo della mappa e si mette `Part of #<mappa>` in cima al figlio. Label: `wayfinder:<tipo>` (`research` / `prototype` / `grilling` / `task`).
- **Blocchi**: dipendenze native di GitHub, `gh api --method POST repos/<owner>/<repo>/issues/<figlio>/dependencies/blocked_by -F issue_id=<id-db-del-bloccante>`, dove l'id è quello **numerico di database** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), non il `#numero`. Ripiego: una riga `Blocked by: #<n>` in cima al figlio.
- **Frontiera**: figlie aperte della mappa, scartando quelle con un bloccante aperto o già assegnate; vince la prima in ordine di mappa.
- **Prendere in carico**: `gh issue edit <n> --add-assignee @me`.
- **Risolvere**: `gh issue comment <n>`, poi `gh issue close <n>`, poi il puntatore nelle Decisioni-finora della mappa.

⚠️ Le label `wayfinder:map` e `wayfinder:<tipo>` **non esistono ancora** in questo repo, e `gh issue create --label <mancante>` fallisce invece di crearla. Vanno create alla prima esecuzione di `/wayfinder`.
