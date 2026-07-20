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
