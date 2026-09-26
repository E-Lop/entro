-- #101 — Le RPC degli inviti restituiscono un codice in error_message, non una
-- frase.
--
-- Il testo che l'utente legge viveva qui, metà in inglese («User not
-- authenticated») e metà in italiano, e nessun client lo poteva tradurre o
-- dire diversamente. Ora error_message è un codice stabile e in inglese, e la
-- frase la sceglie il client: src/lib/inviteErrorMessage.ts su entro,
-- src/shared/lib/inviteErrorMessage.ts su entro-mobile.
--
--   not_authenticated   nessuna sessione
--   invalid_code        codice vuoto
--   invalid_or_expired  nessun invito pending con quel codice
--   expired             invito pending ma scaduto
--   unexpected          errore imprevisto (il ramo exception della #74)
--
-- create_personal_list restituiva sqlerrm, cioè il testo di Postgres: ora
-- unexpected, e il sqlstate va nel log del server come nelle altre due. I
-- client lo avvolgono già in userFacingError, quindi a schermo non cambia
-- niente.
--
-- Va in produzione **dopo** i client che capiscono i codici: entro v1.12.23 ed
-- entro-mobile#196. Un client più vecchio mostrerebbe «expired» a schermo.
--
-- Corpi: quelli in vigore (20260925120000 per le due RPC, 20260109 per
-- create_personal_list, con il search_path che la 20260925120000 le aveva
-- fissato con alter function: create or replace lo riscrive, quindi va
-- ridichiarato). Create or replace conserva i grant della 20260925.
-- I guardiani sono supabase/tests/invite_error_codes.test.sql e
-- supabase/tests/join_rpcs.test.sql.

CREATE OR REPLACE FUNCTION public.accept_pending_invite_by_email()
 RETURNS TABLE(list_id uuid, success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.invites%rowtype;
  v_is_member boolean;
begin
  if v_user_id is null then
    return query select null::uuid, false, 'not_authenticated'::text; return;
  end if;

  select u.email into v_email from auth.users u where u.id = v_user_id;

  select i.* into v_invite
  from public.invites i
  where lower(i.pending_user_email) = lower(v_email)
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
  limit 1;

  if v_invite.id is null then
    return query select null::uuid, false, null::text; return; -- no-op
  end if;

  select exists (
    select 1 from public.list_members lm
    where lm.list_id = v_invite.list_id and lm.user_id = v_user_id
  ) into v_is_member;

  -- Già in un'altra lista: niente, come quando non c'è un invito. L'invito
  -- resta pending e si accetta con il codice, che chiede conferma prima di
  -- lasciare la lista in cui si è (join_list_via_invite).
  if not v_is_member and exists (
    select 1 from public.list_members lm where lm.user_id = v_user_id
  ) then
    return query select null::uuid, false, null::text; return;
  end if;

  if not v_is_member then
    insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
  end if;

  update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;

  return query select v_invite.list_id, true, null::text;
exception
  when others then
    -- Il testo di Postgres non va al client: nel log del server finisce solo
    -- il codice.
    raise warning 'accept_pending_invite_by_email: sqlstate %', sqlstate;
    return query select null::uuid, false, 'unexpected'::text;
end;
$$;

CREATE OR REPLACE FUNCTION public.join_list_via_invite(p_short_code text, p_force boolean DEFAULT false)
 RETURNS TABLE(list_id uuid, success boolean, requires_confirmation boolean, food_count integer, error_message text, only_member boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_current_list_id uuid;
  v_food_count integer;
  v_remaining integer;
  v_other_members integer;
begin
  if v_user_id is null then
    return query select null::uuid, false, false, null::integer, 'not_authenticated'::text, null::boolean; return;
  end if;
  if p_short_code is null or length(trim(p_short_code)) = 0 then
    return query select null::uuid, false, false, null::integer, 'invalid_code'::text, null::boolean; return;
  end if;

  select i.* into v_invite
  from public.invites i
  where i.short_code = upper(p_short_code) and i.status = 'pending';

  if v_invite.id is null then
    return query select null::uuid, false, false, null::integer, 'invalid_or_expired'::text, null::boolean; return;
  end if;

  if v_invite.expires_at <= now() then
    update public.invites set status = 'expired' where id = v_invite.id;
    return query select null::uuid, false, false, null::integer, 'expired'::text, null::boolean; return;
  end if;

  select lm.list_id into v_current_list_id
  from public.list_members lm
  where lm.user_id = v_user_id
  limit 1;

  -- già membro della lista dell'invito
  if v_current_list_id is not null and v_current_list_id = v_invite.list_id then
    update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return query select v_invite.list_id, true, false, null::integer, null::text, null::boolean; return;
  end if;

  -- nessuna lista precedente → join diretto
  if v_current_list_id is null then
    insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
    update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return query select v_invite.list_id, true, false, null::integer, null::text, null::boolean; return;
  end if;

  -- ha un'altra lista → conferma se non forzato
  if not p_force then
    -- Solo gli alimenti in lista: sono quelli che l'utente conosce, e i soli
    -- che l'avviso nomina (#147).
    select count(*)::integer into v_food_count
    from public.foods f
    where f.list_id = v_current_list_id and f.deleted_at is null;
    -- La lista si cancella solo se chi esce ne è l'unico membro: il client
    -- deve saperlo, o annuncerebbe una perdita di dati che non avviene.
    select count(*)::integer into v_other_members
    from public.list_members lm
    where lm.list_id = v_current_list_id and lm.user_id <> v_user_id;
    return query select null::uuid, false, true, v_food_count, null::text, v_other_members = 0; return;
  end if;

  -- force: rimuovi dalla vecchia, cancella se vuota (foods in cascade), aggiungi alla nuova
  delete from public.list_members lm where lm.list_id = v_current_list_id and lm.user_id = v_user_id;
  select count(*)::integer into v_remaining from public.list_members lm where lm.list_id = v_current_list_id;
  if v_remaining = 0 then
    delete from public.lists l where l.id = v_current_list_id;
  end if;
  insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
  update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
  return query select v_invite.list_id, true, false, null::integer, null::text, null::boolean;
exception
  when others then
    raise warning 'join_list_via_invite: sqlstate %', sqlstate;
    return query select null::uuid, false, false, null::integer, 'unexpected'::text, null::boolean;
end;
$$;

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

  insert into public.lists (name, created_by)
  values (v_list_name, v_user_id)
  returning id into v_new_list_id;

  insert into public.list_members (list_id, user_id)
  values (v_new_list_id, v_user_id);

  return query select v_new_list_id, true, null::text;
exception
  when others then
    raise warning 'create_personal_list: sqlstate %', sqlstate;
    return query select null::uuid, false, 'unexpected'::text;
end;
$$;
