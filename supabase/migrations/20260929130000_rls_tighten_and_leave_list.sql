-- #184 — Tre permessi più larghi di quanto i client usino, e l'uscita da una
-- lista come RPC atomica. È la metà «expand»: il DELETE diretto su
-- list_members resta finché i client non passano da leave_list(), e si toglie
-- in una migrazione successiva.
--
-- Riprodotti sul Supabase locale il 28 set 2026, con la propria sessione:
--   1. un membro scriveva un invito direttamente in invites, scegliendo
--      codice, scadenza e stato, saltando create-invite;
--   2. un membro inseriva un alimento con il user_id di un altro, o lo
--      cambiava in update;
--   3. un utente usciva dalla propria lista personale, lasciandola senza
--      membri e invisibile. L'uscita dei client sono due chiamate (DELETE
--      della propria riga, poi create_personal_list): se la seconda fallisce,
--      l'utente resta senza lista.
--
-- Nessuno dei tre espone dati di altri utenti. I client non inseriscono
-- inviti e non scrivono user_id negli update. Tutti i nomi sono qualificati,
-- come vuole il search_path vuoto (#179). Il guardiano è
-- supabase/tests/rls_tighten_leave_list.test.sql.

-- 1. Gli inviti nascono solo da create-invite, che usa la service role.
drop policy "List members can create invites" on public.invites;
revoke insert on public.invites from authenticated, anon;

-- 2a. Un alimento si inserisce solo col proprio user_id.
drop policy "Users can insert foods to their lists" on public.foods;
create policy "Users can insert foods to their lists"
  on public.foods for insert
  with check (
    user_id = auth.uid()
    and list_id is not null
    and list_id in (
      select lm.list_id from public.list_members lm where lm.user_id = auth.uid()
    )
  );

-- 2b. In update user_id non cambia, se a scrivere è un client. La WITH CHECK
-- di una policy non vede la riga di prima, quindi serve un trigger. Il
-- divieto guarda il ruolo e non il cambio in sé: la cancellazione di un
-- account mette a NULL user_id degli alimenti rimasti in una lista condivisa
-- (foods_user_id_fkey, on delete set null), e quella azione della FK gira
-- come proprietario della tabella, non come authenticated.
create function public.prevent_food_owner_change()
 returns trigger
 language plpgsql
 set search_path to ''
as $$
begin
  if new.user_id is distinct from old.user_id
     and current_user in ('authenticated', 'anon') then
    raise exception 'user_id di un alimento non si cambia'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger prevent_food_owner_change
  before update of user_id on public.foods
  for each row execute function public.prevent_food_owner_change();

-- 3. leave_list(): esce da una lista condivisa e crea la lista personale,
-- nella stessa transazione. Rifiuta chi è l'unico membro della sua lista.
-- Gli esiti sono codici, come nelle altre RPC degli inviti (#101):
--   not_authenticated  nessuna sessione
--   not_a_member       l'utente non è in nessuna lista
--   only_member        l'utente è l'unico membro: uscire lascerebbe una
--                      lista orfana
--   unexpected         errore imprevisto; niente è cambiato
-- Compatibile con l'indice unico su list_members(user_id) (#195): la riga
-- vecchia si toglie prima di inserire la nuova.
create function public.leave_list()
 returns table(list_id uuid, success boolean, error_message text)
 language plpgsql
 security definer
 set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_list_id uuid;
  v_other_members integer;
  v_new_list_id uuid;
  v_created boolean;
begin
  if v_user_id is null then
    return query select null::uuid, false, 'not_authenticated'::text;
    return;
  end if;

  select lm.list_id into v_current_list_id
  from public.list_members lm
  where lm.user_id = v_user_id
  limit 1;

  if v_current_list_id is null then
    return query select null::uuid, false, 'not_a_member'::text;
    return;
  end if;

  -- Due membri che escono insieme dalla stessa lista di due: senza il lock
  -- tutti e due vedrebbero l'altro, e la lista resterebbe senza membri.
  perform 1 from public.lists l where l.id = v_current_list_id for update;

  select count(*)::integer into v_other_members
  from public.list_members lm
  where lm.list_id = v_current_list_id and lm.user_id <> v_user_id;

  if v_other_members = 0 then
    return query select null::uuid, false, 'only_member'::text;
    return;
  end if;

  delete from public.list_members lm
  where lm.list_id = v_current_list_id and lm.user_id = v_user_id;

  select cpl.list_id, cpl.success into v_new_list_id, v_created
  from public.create_personal_list() cpl;

  -- Senza lista nuova l'uscita non vale: l'eccezione annulla anche la
  -- cancellazione della riga, e l'utente resta dov'era.
  if not coalesce(v_created, false) or v_new_list_id is null then
    raise exception 'leave_list: lista personale non creata';
  end if;

  return query select v_new_list_id, true, null::text;
exception
  when others then
    raise warning 'leave_list: sqlstate %', sqlstate;
    return query select null::uuid, false, 'unexpected'::text;
end;
$$;

grant execute on function public.leave_list() to authenticated;
