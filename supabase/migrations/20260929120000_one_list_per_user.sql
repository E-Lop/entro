-- #195 — Un utente sta in una lista sola, e lo garantisce il database.
--
-- Fra febbraio e marzo 2026 due utenti si sono trovati con due liste
-- personali: due chiamate concorrenti a create_personal_list al primo
-- accesso, e la funzione controllava e poi inseriva senza lock. Con due righe
-- in list_members la lettura .maybeSingle() dei client va in errore, e
-- salvare un alimento non funziona più. La pulizia in produzione l'ha fatta
-- il maintainer il 28 set 2026: questa migrazione presuppone zero doppioni, e
-- se ne trova uno fallisce invece di sceglierne uno.
--
-- 1. L'indice unico su list_members(user_id). Il vincolo su
--    (list_id, user_id) resta. Le funzioni che scrivono in list_members
--    (join_list_via_invite, accept_pending_invite_by_email,
--    create_default_list_for_user, create_personal_list) inseriscono solo se
--    l'utente non ha righe, oppure tolgono la vecchia prima di aggiungere.
--
-- 2. create_personal_list sotto concorrenza. Con l'indice, la seconda di due
--    chiamate concorrenti aspetta la prima sull'indice e poi viene rifiutata
--    con unique_violation, che il ramo when others trasformava in
--    'unexpected'. Ora la creazione sta in un blocco suo: il rifiuto annulla
--    la lista appena creata (niente liste senza membri) e la funzione
--    restituisce quella che ha vinto la gara, visibile perché in read
--    committed ogni istruzione vede ciò che è stato committato prima di lei.
--
-- Corpo: quello della 20260926120000, con search_path = '' e nomi
-- qualificati. Create or replace conserva i grant.
-- I guardiani sono supabase/tests/one_list_per_user.test.sql e
-- supabase/tests/concurrency/create_personal_list_race.sh.

create unique index list_members_user_id_key on public.list_members (user_id);

CREATE OR REPLACE FUNCTION public.create_personal_list()
 RETURNS TABLE(list_id uuid, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_user_id uuid;
  v_existing_list_id uuid;
  v_new_list_id uuid;
  v_list_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return query select null::uuid, false, 'not_authenticated'::text;
    return;
  end if;

  select lm.list_id into v_existing_list_id
  from public.list_members lm
  where lm.user_id = v_user_id
  limit 1;

  if v_existing_list_id is not null then
    return query select v_existing_list_id, true, null::text;
    return;
  end if;

  select concat('Lista di ', coalesce(
    u.raw_user_meta_data->>'full_name',
    u.email
  ))
  into v_list_name
  from auth.users u
  where u.id = v_user_id;

  begin
    insert into public.lists (name, created_by)
    values (v_list_name, v_user_id)
    returning id into v_new_list_id;

    insert into public.list_members (list_id, user_id)
    values (v_new_list_id, v_user_id);
  exception
    when unique_violation then
      -- Un'altra chiamata ha creato la lista fra il controllo e l'insert:
      -- la nostra è già annullata, si restituisce la sua.
      select lm.list_id into v_existing_list_id
      from public.list_members lm
      where lm.user_id = v_user_id;

      -- Nessuna riga vuol dire che il rifiuto veniva da altro: si rilancia,
      -- e il ramo when others risponde 'unexpected'.
      if v_existing_list_id is null then
        raise;
      end if;

      return query select v_existing_list_id, true, null::text;
      return;
  end;

  return query select v_new_list_id, true, null::text;
exception
  when others then
    raise warning 'create_personal_list: sqlstate %', sqlstate;
    return query select null::uuid, false, 'unexpected'::text;
end;
$$;
