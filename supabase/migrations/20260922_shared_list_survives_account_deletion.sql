-- #152 — Cancellare l'account di un membro non toglie niente agli altri membri.
--
-- In una lista condivisa non c'è un «mio» e un «tuo»: gli alimenti sono della
-- lista. Prima di questa migrazione, cancellare l'account di chi aveva creato
-- una lista portava via la lista intera, e a cascata i suoi alimenti e le
-- iscrizioni degli altri membri (`lists.created_by` era ON DELETE CASCADE).
-- Cancellare l'account di un membro qualsiasi portava via gli alimenti che aveva
-- creato (`foods.user_id` ON DELETE CASCADE, più il `delete` esplicito di
-- `delete_user()`).
--
-- Decisioni (triage del 22 set 2026):
-- - quando un membro se ne va, lista e alimenti restano agli altri;
-- - nessuno eredita: `created_by` e `user_id` diventano null, cioè «un membro
--   che non c'è più», senza inventare un autore;
-- - le foto restano dove sono: quelle rimaste nella cartella di chi se ne va
--   le «ereditano» le liste condivise in cui stanno i loro alimenti.

-- 1) Chi ha creato la lista e chi ha creato l'alimento possono non esistere più.

alter table public.lists alter column created_by drop not null;
alter table public.lists drop constraint lists_created_by_fkey;
alter table public.lists
  add constraint lists_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.foods alter column user_id drop not null;
alter table public.foods drop constraint foods_user_id_fkey;
alter table public.foods
  add constraint foods_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- 2) Le foto che restano agli altri membri.
--
-- Una foto sta nella cartella di chi l'ha caricata (`{user_id}/…`), e le
-- policy dello Storage la aprono a lui e a chi condivide una lista con lui.
-- Quando se ne va, i suoi file restano, ma nessuno è più in una lista con lui.
-- Al momento della cancellazione il trigger della sezione 3 scrive qui quali
-- oggetti della sua cartella usano gli alimenti rimasti, e in quale lista: le
-- policy li aprono ai membri di quella lista.
--
-- Non basta «un alimento delle mie liste punta a questo oggetto»: `image_url`
-- lo scrive l'utente, e chiunque conoscesse un percorso, per esempio un ex
-- membro, potrebbe prendersi la foto puntandola da un alimento suo. Questa
-- tabella invece non la scrive e non la legge nessun client: RLS attiva e
-- nessuna policy.

create table public.inherited_food_images (
  object_name text primary key,
  list_id uuid not null references public.lists(id) on delete cascade,
  inherited_at timestamptz not null default now()
);

alter table public.inherited_food_images enable row level security;

grant select, insert, update, delete on public.inherited_food_images to service_role;

create or replace function public.can_access_inherited_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.inherited_food_images i
    where i.object_name = can_access_inherited_image.object_name
      and i.list_id in (select public.get_user_list_ids())
  );
$$;

grant execute on function public.can_access_inherited_image(text) to authenticated, service_role;
revoke execute on function public.can_access_inherited_image(text) from anon;

-- 3) Quando un utente viene cancellato, si cancella solo ciò che resta senza
-- nessuno.
--
-- Spariscono le liste di cui era l'unico membro, chiunque le abbia create, e
-- quelle che aveva creato e che sono rimaste vuote (da una lista si può uscire
-- da soli); con loro, a cascata su `foods.list_id`, tutti i loro alimenti,
-- compresi quelli tolti con il loro esito. Le liste condivise restano, e gli
-- alimenti che vi aveva creato restano con `user_id` null. Gli alimenti senza
-- lista (righe personali di prima delle liste) non li vede più nessuno: sono
-- dati solo suoi, e vanno via con lui. Le foto della sua cartella che restano
-- agli altri passano in `inherited_food_images`.
--
-- Sta in un trigger su `auth.users`, e non dentro `delete_user()`, perché un
-- utente si cancella anche dalla dashboard o con l'API admin: la regola deve
-- valere per tutte le strade. `before delete`, perché serve sapere di quali
-- liste era membro, e le sue righe in `list_members` se ne vanno con lui.
-- A differenza del trigger di creazione non inghiotte gli errori: se fallisce,
-- la cancellazione si ferma invece di lasciare dietro i dati.

create or replace function public.release_data_of_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.lists l
  where (
      l.id in (select lm.list_id from public.list_members lm where lm.user_id = old.id)
      or l.created_by = old.id
    )
    and not exists (
      select 1 from public.list_members other
      where other.list_id = l.id and other.user_id <> old.id
    );

  delete from public.foods f where f.user_id = old.id and f.list_id is null;

  insert into public.inherited_food_images (object_name, list_id)
  select f.image_url, f.list_id
  from public.foods f
  where f.list_id is not null
    and f.image_url like old.id::text || '/%'
  on conflict (object_name) do nothing;

  delete from public.invites i
  where i.created_by = old.id
     or i.pending_user_email = old.email;

  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row
  execute function public.release_data_of_deleted_user();

-- `delete_user()` resta la strada dell'app: controlla chi chiama e cancella
-- l'utente; il resto lo fa il trigger.

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = current_user_id;
end;
$$;

grant execute on function public.delete_user() to authenticated, service_role;
revoke execute on function public.delete_user() from anon;

-- 4) Anteprima per il dialogo di cancellazione: la lista è condivisa? Quanti
-- alimenti in lista andrebbero persi?
--
-- La risposta sta sul server perché è il server a decidere cosa cancellare:
-- un client che la deducesse da sé potrebbe dire una cosa e farne un'altra.
-- `active_food_count` conta solo gli alimenti in lista (`deleted_at is null`),
-- cioè quelli che l'utente conosce; nel caso condiviso il dialogo non lo usa.
-- Un utente sta in una lista sola (l'invito lo sposta, non lo aggiunge): se
-- mai ne avesse due, `list_shared` direbbe «condivisa» appena una lo è, e il
-- conteggio le sommerebbe.

create or replace function public.account_deletion_preview()
returns table (list_shared boolean, active_food_count integer)
language sql
stable
security definer
set search_path = public
as $$
  with my_lists as (
    select lm.list_id from public.list_members lm where lm.user_id = auth.uid()
  )
  select
    exists (
      select 1 from public.list_members other
      join my_lists using (list_id)
      where other.user_id <> auth.uid()
    ) as list_shared,
    (
      select count(*)::integer from public.foods f
      join my_lists using (list_id)
      where f.deleted_at is null
    ) as active_food_count;
$$;

grant execute on function public.account_deletion_preview() to authenticated, service_role;
revoke execute on function public.account_deletion_preview() from anon;

-- 5) Le policy dello Storage aprono anche le foto ereditate.
--
-- Le regole per cartella restano com'erano (quella propria, o quella di un
-- membro di una lista in comune): servono al caricamento e alla sostituzione
-- (#116). Si aggiunge un caso, per lettura, sostituzione e rimozione: la foto è
-- stata ereditata da una delle mie liste. L'INSERT non cambia.

drop policy "Users can view own images or shared list images" on storage.objects;
create policy "Users can view own images or shared list images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
      or public.can_access_inherited_image(name)
    )
  );

drop policy "Users can update own images or shared list images" on storage.objects;
create policy "Users can update own images or shared list images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
      or public.can_access_inherited_image(name)
    )
  )
  with check (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
      or public.can_access_inherited_image(name)
    )
  );

drop policy "Users can delete own images or shared list images" on storage.objects;
create policy "Users can delete own images or shared list images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
      or public.can_access_inherited_image(name)
    )
  );
