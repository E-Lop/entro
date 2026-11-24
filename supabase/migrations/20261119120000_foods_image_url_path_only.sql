-- #230 — foods.image_url accetta solo un percorso d'archivio.
--
-- La colonna è text senza vincoli dallo schema di base. Il contratto stava
-- solo nel bundle di famiglia (entro-family/core/food-images.md): un percorso
-- `{user_id}/{nome del file}`, più gli URL interi di alcune righe legacy. Ma
-- in una lista condivisa ogni membro scrive le righe degli alimenti, quindi un
-- client poteva leggere qualunque forma l'avesse scritta un altro.
--
-- Il conteggio in produzione del 20 ott 2026 ha trovato 14 valori, tutti
-- percorsi: nessun URL intero, nessun pending://. Per questo il vincolo entra
-- in un passo solo, senza NOT VALID, e non ammette gli URL (deciso dal
-- maintainer il 19 nov 2026). Subito prima del push in produzione si rilancia
-- la stessa lettura, per chiudere la finestra in cui un client vecchio avesse
-- scritto altro.
--
-- La forma è quella che le policy di storage.objects leggono: il primo
-- segmento è la cartella dell'utente, un uuid minuscolo come quelli di
-- auth.users; il resto è il nome del file, senza «/». Il vincolo non impedisce
-- un percorso valido nella cartella di un altro utente: è il limite già scritto
-- nel bundle.
--
-- Il guardiano è supabase/tests/foods_image_url_path_only.test.sql.

alter table public.foods
  add constraint foods_image_url_is_archive_path
  check (image_url is null or image_url ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$');

comment on constraint foods_image_url_is_archive_path on public.foods is
  'image_url è un percorso d''archivio {uuid utente}/{nome del file}, mai un URL (#230). La forma è quella che le policy di storage.objects leggono.';
