-- Hardening join list_members — issue #70 (+ #71)
-- Membership solo via invito valido, mediata da RPC SECURITY DEFINER.
-- Riferimenti: https://supabase.com/docs/guides/database/functions
--              https://supabase.com/docs/guides/database/postgres/row-level-security

-- 1) Helper: email autoritativa del caller (da auth.users, non dal JWT)
create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email from auth.users u where u.id = auth.uid();
$$;

grant execute on function public.current_user_email() to authenticated, service_role;

-- 2) RPC: auto-accept dell'invito pending indirizzato alla propria email
create or replace function public.accept_pending_invite_by_email()
returns table (list_id uuid, success boolean, error_message text)
language plpgsql
security definer
set search_path = ''
as $$
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

  if not v_is_member then
    insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
  end if;

  update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;

  return query select v_invite.list_id, true, null::text;
end;
$$;

grant execute on function public.accept_pending_invite_by_email() to authenticated, service_role;

-- 3) RPC: accept per codice con logica single-list (conferma/food_count/force-swap)
create or replace function public.join_list_via_invite(
  p_short_code text,
  p_force boolean default false
)
returns table (list_id uuid, success boolean, requires_confirmation boolean, food_count integer, error_message text)
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
begin
  if v_user_id is null then
    return query select null::uuid, false, false, null::integer, 'User not authenticated'::text; return;
  end if;
  if p_short_code is null or length(trim(p_short_code)) = 0 then
    return query select null::uuid, false, false, null::integer, 'Invito non valido'::text; return;
  end if;

  select i.* into v_invite
  from public.invites i
  where i.short_code = upper(p_short_code) and i.status = 'pending';

  if v_invite.id is null then
    return query select null::uuid, false, false, null::integer, 'Invito non valido o scaduto'::text; return;
  end if;

  if v_invite.expires_at <= now() then
    update public.invites set status = 'expired' where id = v_invite.id;
    return query select null::uuid, false, false, null::integer, 'Questo invito è scaduto'::text; return;
  end if;

  select lm.list_id into v_current_list_id
  from public.list_members lm
  where lm.user_id = v_user_id
  limit 1;

  -- già membro della lista dell'invito
  if v_current_list_id is not null and v_current_list_id = v_invite.list_id then
    update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return query select v_invite.list_id, true, false, null::integer, null::text; return;
  end if;

  -- nessuna lista precedente → join diretto
  if v_current_list_id is null then
    insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
    update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
    return query select v_invite.list_id, true, false, null::integer, null::text; return;
  end if;

  -- ha un'altra lista → conferma se non forzato
  if not p_force then
    select count(*)::integer into v_food_count from public.foods f where f.list_id = v_current_list_id;
    return query select null::uuid, false, true, v_food_count, null::text; return;
  end if;

  -- force: rimuovi dalla vecchia, cancella se vuota (foods in cascade), aggiungi alla nuova
  delete from public.list_members lm where lm.list_id = v_current_list_id and lm.user_id = v_user_id;
  select count(*)::integer into v_remaining from public.list_members lm where lm.list_id = v_current_list_id;
  if v_remaining = 0 then
    delete from public.lists l where l.id = v_current_list_id;
  end if;
  insert into public.list_members (list_id, user_id) values (v_invite.list_id, v_user_id);
  update public.invites set status = 'accepted', accepted_at = now() where id = v_invite.id;
  return query select v_invite.list_id, true, false, null::integer, null::text;
end;
$$;

grant execute on function public.join_list_via_invite(text, boolean) to authenticated, service_role;

-- 4) Write hardening: niente insert diretto client su list_members
drop policy if exists "Users can add themselves to a list via invite" on public.list_members;
revoke insert on public.list_members from authenticated;
-- Restano: SELECT (proprie liste) e DELETE (auth.uid()=user_id, self-leave).
-- create_personal_list e le RPC sopra (SECURITY DEFINER) + edge accept-invite
-- (service_role) continuano a funzionare.

-- 5) Read hardening: niente harvest di short_code/inviti altrui
drop policy if exists "Authenticated can read pending or own-list invites" on public.invites;
create policy "Authenticated can read own-list or own-email invites"
  on public.invites for select
  to authenticated
  using (
    list_id in (select public.get_user_list_ids())
    or lower(pending_user_email) = lower(public.current_user_email())
  );

-- L'accept passa dalle RPC: il client non aggiorna più invites.
drop policy if exists "Authenticated can update pending or own-list invites" on public.invites;
revoke update on public.invites from authenticated;
