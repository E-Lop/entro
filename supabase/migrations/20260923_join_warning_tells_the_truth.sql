-- #147 — L'avviso prima di accettare un invito dice ciò che succede davvero.
--
-- Accettando un invito si lascia la lista in cui si è. `join_list_via_invite`
-- la cancella, con i suoi alimenti, solo se chi esce ne era l'unico membro; se
-- è condivisa resta agli altri. Il client però annunciava sempre «saranno
-- eliminati», perché la RPC non gli diceva in quale caso si era. E il numero
-- contava anche gli alimenti già tolti con il loro esito.
--
-- - nuova colonna `only_member`, in fondo: `true` se chi esce è l'unico membro
--   della lista che lascia, `null` fuori dalla richiesta di conferma;
-- - `food_count` conta solo gli alimenti in lista (`deleted_at is null`).
--
-- Cambiare le colonne restituite obbliga a `drop` + `create`, quindi i GRANT
-- si riscrivono. Solo aggiunte: `src/shared/lib/invites.ts` di entro-mobile
-- chiama la stessa RPC e legge le colonne per nome.

drop function public.join_list_via_invite(text, boolean);

create function public.join_list_via_invite(
  p_short_code text,
  p_force boolean default false
)
returns table (list_id uuid, success boolean, requires_confirmation boolean, food_count integer, error_message text, only_member boolean)
language plpgsql
security definer
set search_path = ''
as $$
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
end;
$$;

grant execute on function public.join_list_via_invite(text, boolean) to authenticated, service_role;
revoke execute on function public.join_list_via_invite(text, boolean) from anon;
