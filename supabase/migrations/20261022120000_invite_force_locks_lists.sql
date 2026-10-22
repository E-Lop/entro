-- #239 — Il ramo con conferma di join_list_via_invite() prende il lock sulle
-- due liste prima di toccare list_members.
--
-- Con la conferma (p_force) la funzione toglie la riga di chi esce, conta chi
-- resta e cancella la lista se è vuota: lo stesso lavoro di leave_list() e
-- remove_list_member(), che però prendono prima il FOR UPDATE sulla lista. Gli
-- ultimi due membri che uscivano insieme, accettando un invito o con
-- leave_list(), si contavano a vicenda ancora dentro, e la lista restava senza
-- membri con i suoi alimenti. Lo prova
-- supabase/tests/concurrency/join_list_via_invite_race.sh, rosso sulla
-- definizione di 20261019120000_invite_force_keeps_photos.sql.
--
-- Il corpo è quello di quella migrazione, con il lock prima del delete. Firma,
-- codici di risposta e segno delle foto (#236) non cambiano. create or replace
-- conserva i permessi: authenticated esegue, anon no.
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

  -- force: rimuovi dalla vecchia, cancella se vuota (foods in cascade), aggiungi alla nuova.
  --
  -- Prima, il lock sulle due liste, in ordine di id (#239). Quella di
  -- partenza perché togliere la riga, contare chi resta e cancellare la lista
  -- vuota sia in fila con leave_list() e remove_list_member(), che prendono lo
  -- stesso lock, e con un altro join: senza, due uscite insieme si contano a
  -- vicenda ancora dentro e la lista resta senza membri. Quella di
  -- destinazione perché l'insert in list_members ne prende il FOR KEY SHARE
  -- (controllo della chiave esterna), che è in conflitto con FOR UPDATE: con
  -- il lock sulla sola partenza, X da L1 a L2 e Y da L2 a L1 andrebbero in
  -- deadlock. In ordine di id, come chiede la doc di Postgres («acquire locks
  -- on multiple objects in a consistent order»). Prima del delete, perché
  -- inherited_food_images.list_id è on delete cascade: il segno delle foto
  -- (#236) non deve poter sparire con una lista cancellata da un'altra
  -- transazione.
  perform 1
  from public.lists l
  where l.id in (v_current_list_id, v_invite.list_id)
  order by l.id
  for update;

  delete from public.list_members lm where lm.list_id = v_current_list_id and lm.user_id = v_user_id;
  select count(*)::integer into v_remaining from public.list_members lm where lm.list_id = v_current_list_id;
  if v_remaining = 0 then
    delete from public.lists l where l.id = v_current_list_id;
  else
    -- Le foto degli alimenti che restano nella lista, caricate da chi esce:
    -- chi resta continua a leggerle (#236), come con leave_list() (#226).
    insert into public.inherited_food_images (object_name, list_id)
    select f.image_url, f.list_id
    from public.foods f
    where f.list_id = v_current_list_id
      and f.image_url like v_user_id::text || '/%'
    on conflict (object_name) do nothing;
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
