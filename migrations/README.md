# Migration storiche

Questa cartella contiene migration storiche scritte prima del consolidamento della catena Supabase canonica.

La fonte operativa per `supabase db reset`, CI e nuovi setup deve essere:

```text
supabase/migrations/
```

Non aggiungere nuove migration in questa cartella. Se serve recuperare contesto storico, leggere questi file e poi portare la modifica nella catena canonica in `supabase/migrations/`.

## Regola: le migration applicate sono immutabili

Una volta che una migration è stata applicata in produzione, il suo file **non
va più modificato**. Il repo deve riflettere cosa è realmente girato sul
database, altrimenti la history non è più auditabile. Ogni correzione (GRANT
mancanti, fix difensivi, ecc.) va in una **nuova migration additiva** in
`supabase/migrations/`, non con un edit in-place della migration già applicata.

Eccezione storica: la baseline `20260109_baseline_core_schema.sql` è una
ricostruzione in sola lettura (mai applicata in produzione) e alcune migration
push sono state ritoccate durante il consolidamento 2026-07 prima che la regola
fosse formalizzata. Da qui in avanti vale l'immutabilità.
