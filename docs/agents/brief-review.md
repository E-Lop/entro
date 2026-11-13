# Revisione degli agent brief con EGM

> Scritto a mano il 13 nov 2026, dopo la prova su tre brief: E-Lop/entro#267, #271 e #250. Conteggi e confronto stanno in E-Lop/entro-mobile#193.

Un agent brief che sta per passare a `ready-for-agent` si può far rivedere con `/egm:egm-review-loop` (plugin EGM, `google/elephant-goldfish-model`). I revisori sono subagenti senza la conversazione: leggono solo il brief e i file che gli si passano. Trovano le affermazioni che chi ha scritto il brief dà per vere senza averle misurate. Nelle tre prove erano quasi sempre le mie.

## La configurazione

| | |
|---|---|
| **Revisori** | `codebase_details` e `implementation_readiness`. `structural` no: dal secondo round chiede solo caselle in più. |
| **Standard** | per tutti e due le **regole del progetto** qui sotto, non lo standard di EGM. Quello chiede i percorsi dei file da creare, che la forma del brief vieta: sulla #267 era metà dei rilievi falsi. |
| **Contesto** | la issue con i commenti, e i file che il brief nomina. **I sorgenti esterni si salvano come file**, perché i revisori non aprono gli URL: un'azione, la CLI di Supabase, un pacchetto in `node_modules`. |
| **Round** | 2 al massimo. La convergenza (due round puliti di fila) non è mai arrivata, né in 2 né in 4 round, e il secondo trova già solo rilievi di precisione. Al tetto il maintainer accetta il brief con le correzioni. |
| **Dispatch** | diretto: i revisori in parallelo dal contesto principale, senza synthesizer. |

Il report (`goldfish_review_report.md`) EGM lo scrive nella working directory. Va spostato fuori dal repo a fine round, e il brief rivisto si pubblica a mano nella issue.

## Le regole del progetto, per i revisori

I revisori non leggono `CLAUDE.md` (`omitClaudeMd`). Il file di regole che gli si passa contiene le righe generali più quelle dell'ambito del brief.

### Generali

- **La forma del brief** è quella della skill `triage` (`mattpocock-skills`): Category, Summary, Current e Desired behavior, Key interfaces, Acceptance criteria verificabili uno per uno, Out of scope. I comportamenti si descrivono; gli statement esatti li sceglie l'agente.
- **Nomi di file stabili sono ammessi** quando il progetto li nomina per sé (`CLAUDE.md`, `log.md`, `index.md`, `viewer/index.html`, `.github/workflows/ci.yml`, i nomi delle migrazioni come precedenti). Non si chiedono percorsi per i file da creare: si chiede la regola del nome.
- **Il dominio vive in `entro-family`** (`core/` per le entità, `conventions/` per i pattern di più prodotti). Un brief non ridefinisce il dominio, lo cita. Una regola che vale per più client va nel bundle, con una PR su entro-family che segue il processo del `CLAUDE.md` di entro-family (pagina, `index.md`, `log.md`; `viewer/index.html` non si committa mai).
- **Codice in inglese, documentazione e commenti in italiano.** I nomi dei file versionati sono codice, e li controlla `npm run test:family`, da lanciare dopo `git add`.
- **Test oltre il caso felice**: casi limite, autorizzazioni e vincoli si provano sul backend, non solo come avviso in UI.
- **Quello che il brief non ha misurato si scrive «non verificato»**, con un criterio che lo controlla.
- **Nessuna azione sulla produzione**: pre-push, `db push`, tag e release sono del maintainer.

### Database

- **Il backend Supabase è uno solo**, per la PWA e per entro-mobile: il brief dice cosa succede a ciascuno dei due client.
- **La CI usa la CLI Supabase 2.108.0, in locale c'è la 3.0.0.** I privilegi di default di tabelle e funzioni possono essere diversi fra le due immagini, quindi un test che misura i privilegi deve passare su tutte e due.

### CI

- **In CI si verifica nel log, non per ipotesi.** Un comportamento di un'azione, della CLI o di apt che il brief non ha misurato ha un criterio che lo controlla nel log della corsa della PR.
- **Le versioni sono fissate** (`supabase/setup-cli`, CLI Supabase, `@playwright/test`): il brief non le cambia, salvo che lo dica.
- **Il runner `ubuntu-latest` passa a Ubuntu 26.04**, con la migrazione completa entro il 19 nov 2026: un brief non dà per scontato né il 24.04 né il 26.04.
- **Le cause esterne** (registri di immagini, mirror apt, DNS) non si correggono: si rende il job meno esposto. Un criterio dice cosa fare se il servizio è giù.
