-- #226 — Chi esce da una lista condivisa non fa perdere le foto dei suoi
-- alimenti a chi resta.
--
-- Un alimento resta nella lista quando chi l'ha inserito esce, ma la sua foto
-- sta nella cartella di chi l'ha caricata, e gli altri membri la leggono solo
-- finché lui è nella lista (get_shared_list_member_ids). La cancellazione
-- dell'account (#152) e remove_list_member() (#196) segnano già le foto degli
-- alimenti che restano in inherited_food_images; leave_list() no, e chi
-- restava vedeva il riquadro degli alimenti senza foto.
--
-- Il corpo è quello di 20260929130000_rls_tighten_and_leave_list.sql, con in
-- più il segno delle foto, scritto come in remove_list_member(). Sta dopo il
-- controllo «only_member», quindi un'uscita rifiutata non segna niente; e
-- l'eccezione annulla anche il segno, se l'uscita fallisce più avanti.
-- create or replace conserva i permessi: authenticated esegue, anon no.
-- Il guardiano è supabase/tests/leave_list_keeps_photos.test.sql.
create or replace function public.leave_list()
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

  -- Le foto degli alimenti che restano nella lista, caricate da chi esce:
  -- chi resta continua a leggerle (#226).
  insert into public.inherited_food_images (object_name, list_id)
  select f.image_url, f.list_id
  from public.foods f
  where f.list_id = v_current_list_id
    and f.image_url like v_user_id::text || '/%'
  on conflict (object_name) do nothing;

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
