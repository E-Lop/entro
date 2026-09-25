-- #74 — Le RPC di adesione a una lista: lista singola, errori imprevisti,
-- un grant morto e tre search_path.
--
-- - accept_pending_invite_by_email non aggiunge a una seconda lista chi ne ha
--   già una: da lì getUserList().maybeSingle() va in errore. Il flusso
--   dell'app la chiama solo senza liste, ma la RPC si può chiamare da sola.
-- - join_list_via_invite e accept_pending_invite_by_email rispondono
--   success = false anche sugli errori imprevisti (un doppio invio, un vincolo),
--   con un testo fisso: i client mostrano error_message all'utente, quindi il
--   messaggio di Postgres non ci va, a differenza di create_personal_list.
-- - authenticated perde UPDATE su list_members, che non ha policy di update.
-- - search_path fissato sulle tre SECURITY DEFINER che non l'avevano.
--
-- Corpo delle due RPC: quello in vigore (20260720 e 20260923), più la guardia
-- e l'handler. I grant restano quelli della 20260925.
-- Il guardiano è supabase/tests/join_rpcs.test.sql.

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
    return query select null::uuid, false, 'User not authenticated'::text; return;
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
    -- Il testo di Postgres non va al client, che mostra error_message
    -- all'utente: nel log del server finisce solo il codice.
    raise warning 'accept_pending_invite_by_email: sqlstate %', sqlstate;
    return query select null::uuid, false, 'Non è stato possibile accettare l''invito. Riprova.'::text;
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
    return query select null::uuid, false, false, null::integer, 'User not authenticated'::text, null::boolean; return;
  end if;
  if p_short_code is null or length(trim(p_short_code)) = 0 then
    return query select null::uuid, false, false, null::integer, 'Invito non valido'::text, null::boolean; return;
  end if;

  select i.* into v_invite
  from public.invites i
  where i.short_code = upper(p_short_code) and i.status = 'pending';

  if v_invite.id is null then
    return query select null::uuid, false, false, null::integer, 'Invito non valido o scaduto'::text, null::boolean; return;
  end if;

  if v_invite.expires_at <= now() then
    update public.invites set status = 'expired' where id = v_invite.id;
    return query select null::uuid, false, false, null::integer, 'Questo invito è scaduto'::text, null::boolean; return;
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
    return query select null::uuid, false, false, null::integer, 'Non è stato possibile accettare l''invito. Riprova.'::text, null::boolean;
end;
$$;

revoke update on public.list_members from authenticated;

-- I corpi usano già nomi qualificati.
alter function public.get_user_list_ids() set search_path = '';
alter function public.get_shared_list_member_ids() set search_path = '';
alter function public.create_personal_list() set search_path = '';
