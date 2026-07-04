# Migration storiche

Questa cartella contiene migration storiche scritte prima del consolidamento della catena Supabase canonica.

La fonte operativa per `supabase db reset`, CI e nuovi setup deve essere:

```text
supabase/migrations/
```

Non aggiungere nuove migration in questa cartella. Se serve recuperare contesto storico, leggere questi file e poi portare la modifica nella catena canonica in `supabase/migrations/`.
