-- #196 — Chi ha creato una lista condivisa può togliere un membro.
--
-- Fino a oggi chi entrava in una lista per errore ci restava finché non usciva
-- da sé: la revoca degli inviti (#194) previene, non rimedia. Decisioni del
-- maintainer del 7 ott 2026, scritte sulla issue:
--   - toglie il creatore della lista (lists.created_by), finché ne fa parte;
--     se non ne fa parte (ha cancellato l'account, o è uscito con
--     leave_list()), il membro entrato da più tempo;
--   - gli alimenti di chi viene tolto restano nella lista, e lui riparte da
--     una lista personale vuota;
--   - togliere un membro revoca tutti gli inviti ancora attivi della lista, di
--     chiunque siano: un codice non ha destinatario;
--   - il rientro con un invito nuovo non è impedito;
--   - chi è stato tolto con l'app chiusa lo scopre alla riapertura, una volta.
--
-- Tutti i nomi sono qualificati, come vuole il search_path vuoto (#179), e
-- ogni funzione ha la sua revoca da PUBLIC (#160). Il guardiano è
-- supabase/tests/remove_list_member.test.sql, con la prova di concorrenza
-- supabase/tests/concurrency/remove_list_member_race.sh.

-- 1. Chi può togliere da una lista. Il creatore, se ne fa parte; altrimenti
-- il membro entrato da più tempo. joined_at può essere vuoto nelle righe più
-- vecchie: una data che manca vale come la più antica, e a parità decide
-- l'id della riga. Non conta l'ordine in sé, conta che sia sempre lo stesso.
-- Non è SECURITY DEFINER e non ha grant: la chiamano solo le due funzioni qui
-- sotto, che girano come proprietario.
create function public.list_remover(p_list_id uuid)
 returns uuid
 language sql
 stable
 set search_path to ''
as $$
  select coalesce(
    (select l.created_by
     from public.lists l
     join public.list_members lm on lm.list_id = l.id and lm.user_id = l.created_by
     where l.id = p_list_id),
    (select lm.user_id
     from public.list_members lm
     where lm.list_id = p_list_id
     order by lm.joined_at asc nulls first, lm.id asc
     limit 1)
  );
$$;

revoke execute on function public.list_remover(uuid) from public, anon, authenticated;

-- 2. L'avviso per chi è stato tolto. Una riga per utente, scritta solo da
-- remove_list_member: il client la legge alla riapertura, mostra l'avviso e
-- la cancella, così l'avviso compare una volta sola su qualunque dispositivo.
-- list_id dice da quale lista: chi nel frattempo è rientrato non va avvisato.
create table public.list_removal_notices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  list_id uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_list_removal_notices_list_id on public.list_removal_notices (list_id);

alter table public.list_removal_notices enable row level security;

create policy "Users can read their removal notice"
  on public.list_removal_notices for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can dismiss their removal notice"
  on public.list_removal_notices for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.list_removal_notices from public, anon, authenticated;
grant select, delete on public.list_removal_notices to authenticated;
grant all on public.list_removal_notices to service_role;

-- 3. remove_list_member(): toglie un altro membro dalla lista di chi chiama.
-- Nella stessa transazione toglie la riga, crea la lista personale della
-- persona tolta, revoca gli inviti attivi della lista e lascia l'avviso. Se
-- un passo fallisce non resta niente a metà, e nessuno resta senza lista.
-- Gli esiti sono codici, come per leave_list() (#184):
--   not_authenticated   nessuna sessione
--   cannot_remove_self  il bersaglio è chi chiama: per uscire c'è leave_list()
--   not_authorized      chi chiama non è in una lista, o non è chi può togliere
--   not_a_member        il bersaglio non è nella lista di chi chiama
--   unexpected          errore imprevisto; niente è cambiato
--
-- Le foto. Un alimento resta nella lista, ma la sua foto sta nella cartella di
-- chi l'ha caricata, e gli altri membri la leggono solo finché lui è nella
-- lista (get_shared_list_member_ids). Per questo le foto degli alimenti che
-- restano si segnano in inherited_food_images, come alla cancellazione di un
-- account (#152): chi resta continua a vederle.
create function public.remove_list_member(p_user_id uuid)
 returns table(success boolean, error_message text)
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  v_caller uuid := auth.uid();
  v_list_id uuid;
  v_new_list_id uuid;
  v_list_name text;
begin
  if v_caller is null then
    return query select false, 'not_authenticated'::text;
    return;
  end if;

  if p_user_id = v_caller then
    return query select false, 'cannot_remove_self'::text;
    return;
  end if;

  select lm.list_id into v_list_id
  from public.list_members lm
  where lm.user_id = v_caller
  limit 1;

  if v_list_id is null then
    return query select false, 'not_authorized'::text;
    return;
  end if;

  -- Lo stesso lock di leave_list(): una rimozione e un'uscita dalla stessa
  -- lista si mettono in fila, e chi viene dopo vede ciò che ha fatto l'altra.
  perform 1 from public.lists l where l.id = v_list_id for update;

  -- Dopo il lock: chi chiama può essere uscito nell'attesa, e allora chi può
  -- togliere non è più lui.
  if public.list_remover(v_list_id) is distinct from v_caller then
    return query select false, 'not_authorized'::text;
    return;
  end if;

  if p_user_id is null or not exists (
    select 1 from public.list_members lm
    where lm.list_id = v_list_id and lm.user_id = p_user_id
  ) then
    return query select false, 'not_a_member'::text;
    return;
  end if;

  insert into public.inherited_food_images (object_name, list_id)
  select f.image_url, f.list_id
  from public.foods f
  where f.list_id = v_list_id
    and f.image_url like p_user_id::text || '/%'
  on conflict (object_name) do nothing;

  -- La riga vecchia prima della nuova: l'indice unico su list_members(user_id)
  -- (#195) rifiuterebbe l'ordine inverso.
  delete from public.list_members lm
  where lm.list_id = v_list_id and lm.user_id = p_user_id;

  select concat('Lista di ', coalesce(u.raw_user_meta_data->>'full_name', u.email))
  into v_list_name
  from auth.users u
  where u.id = p_user_id;

  insert into public.lists (name, created_by)
  values (v_list_name, p_user_id)
  returning id into v_new_list_id;

  insert into public.list_members (list_id, user_id)
  values (v_new_list_id, p_user_id);

  delete from public.invites i
  where i.list_id = v_list_id and i.status = 'pending';

  insert into public.list_removal_notices (user_id, list_id)
  values (p_user_id, v_list_id)
  on conflict (user_id) do update
    set list_id = excluded.list_id, created_at = now();

  return query select true, null::text;
exception
  when others then
    raise warning 'remove_list_member: sqlstate %', sqlstate;
    return query select false, 'unexpected'::text;
end;
$$;

revoke execute on function public.remove_list_member(uuid) from public, anon;
grant execute on function public.remove_list_member(uuid) to authenticated;
grant execute on function public.remove_list_member(uuid) to service_role;

-- 4. I membri che chi chiama può togliere, col nome da mostrare: il nome
-- completo, o l'email quando il nome manca. Risponde solo a chi può togliere;
-- a chiunque altro, zero righe. È l'unica lettura che dà nomi ed email degli
-- altri membri, e list_members da sola non li contiene.
create function public.list_members_for_removal()
 returns table(user_id uuid, display_name text, joined_at timestamptz)
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select lm.user_id,
         coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), u.email::text),
         lm.joined_at
  from public.list_members me
  join public.list_members lm on lm.list_id = me.list_id and lm.user_id <> me.user_id
  join auth.users u on u.id = lm.user_id
  where me.user_id = (select auth.uid())
    and public.list_remover(me.list_id) = (select auth.uid())
  order by lm.joined_at asc nulls first, lm.id asc;
$$;

revoke execute on function public.list_members_for_removal() from public, anon;
grant execute on function public.list_members_for_removal() to authenticated;
grant execute on function public.list_members_for_removal() to service_role;
