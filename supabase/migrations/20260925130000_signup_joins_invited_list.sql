-- #165 — Chi si registra con un codice invito nasce nella lista di chi l'ha
-- invitato.
--
-- Dalla 20260818 (#94) questo trigger dà una lista a ogni utente nuovo. Il
-- codice però arrivava dopo: il client lo registrava con
-- register_pending_invite a registrazione finita, e al primo accesso trovava
-- già la lista del trigger, quindi non accettava più l'invito. L'invitato
-- restava fuori, per ogni utente nuovo invitato: anche il link /join/:codice
-- porta alla registrazione con il codice.
--
-- Ora il client mette il codice nei metadati della registrazione
-- (raw_user_meta_data->>'invite_code'), e il trigger lo usa mentre crea
-- l'utente: con un invito pending e non scaduto lo mette nella lista
-- dell'invito, segna l'invito accettato, e non crea la lista propria. In ogni
-- altro caso fa quello che faceva prima.
--
-- Il codice nei metadati lo scrive chi si registra, quindi non è fidato: dà
-- esattamente l'accesso che join_list_via_invite darebbe con lo stesso codice.
-- Il guardiano è supabase/tests/signup_invite_code.test.sql.

create or replace function public.create_default_list_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_list_id uuid;
  pending_invite_count integer;
  list_name text;
  v_invite_code text;
  v_invite_id uuid;
  v_invite_list_id uuid;
begin
  -- Un codice invito valido nei metadati: si entra nella lista dell'invito.
  v_invite_code := upper(nullif(trim(new.raw_user_meta_data->>'invite_code'), ''));
  if v_invite_code is not null then
    select i.id, i.list_id into v_invite_id, v_invite_list_id
    from public.invites i
    where i.short_code = v_invite_code
      and i.status = 'pending'
      and i.expires_at > now();

    if v_invite_id is not null then
      insert into public.list_members (list_id, user_id)
      values (v_invite_list_id, new.id);
      update public.invites
      set status = 'accepted', accepted_at = now()
      where id = v_invite_id;
      return new;
    end if;
  end if;

  -- Chi ha un invito valido non riceve una lista propria: entrerà in quella di
  -- chi lo ha invitato, e dargliene una qui la lascerebbe orfana.
  select count(*) into pending_invite_count
  from public.invites
  where email = new.email
    and status = 'pending'
    and expires_at > now();

  if pending_invite_count = 0 then
    list_name := concat('Lista di ', coalesce(
      new.raw_user_meta_data->>'full_name',
      new.email
    ));

    insert into public.lists (created_by, name)
    values (new.id, list_name)
    returning id into new_list_id;

    insert into public.list_members (list_id, user_id)
    values (new_list_id, new.id);
  end if;

  return new;
exception
  when others then
    raise warning 'create_default_list_for_user fallita per % : %', new.id, sqlerrm;
    return new;
end;
$$;
