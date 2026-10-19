-- #236 — Chi accetta un invito confermando di lasciare una lista condivisa non
-- fa perdere le foto dei suoi alimenti a chi resta.
--
-- È il quarto modo di uscire da una lista. Gli altri tre, la cancellazione
-- dell'account (#152), remove_list_member() (#196) e leave_list() (#226),
-- segnano già le foto degli alimenti che restano in inherited_food_images; il
-- ramo con conferma di join_list_via_invite() no. Senza il segno valgono le
-- clausole di cartella dello Storage (#228): chi resta perdeva la foto, e chi
-- era uscito e la sua nuova co-membro la leggevano, sostituivano e
-- cancellavano.
--
-- Il corpo è quello di 20260926120000_invite_error_codes.sql, con in più il
-- segno delle foto, scritto come in leave_list(). Sta dopo la cancellazione
-- della riga e solo se nella lista resta qualcuno: se chi esce era l'unico
-- membro la lista si cancella come prima, e non resta niente da segnare.
-- L'eccezione annulla anche il segno, se l'accettazione fallisce più avanti.
-- create or replace conserva i permessi: authenticated esegue, anon no.
-- Il guardiano è supabase/tests/invite_force_keeps_photos.test.sql.
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
