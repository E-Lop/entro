-- #228 — Una foto ereditata da una lista è dei membri di quella lista.
--
-- La foto di un alimento sta nella cartella di chi l'ha caricata. Quando lui
-- esce dalla lista (cancellazione dell'account #152, remove_list_member #196,
-- leave_list #226), la lista la eredita in inherited_food_images e i suoi
-- membri continuano a leggerla con can_access_inherited_image(). Ma le policy
-- dello Storage lasciavano passare ancora due clausole di cartella:
--   - «cartella mia»: chi era uscito leggeva, sostituiva e cancellava la foto;
--   - «cartella di un co-membro»: chi stava con lui nella lista nuova faceva
--     lo stesso, senza essere mai stato nella lista che l'aveva ereditata.
-- Se la cancellavano, chi restava perdeva la foto (riprodotto il 16 ott 2026,
-- commento sulla #228).
--
-- Decisioni del maintainer: l'oggetto è della lista, non di chi l'ha caricato
-- (12 ott); si chiudono lettura, sostituzione e rimozione, nelle policy, senza
-- spostare i file (12 ott); l'esclusione vale per tutte e due le clausole di
-- cartella (16 ott). Le foto che nessuna lista ha ereditato restano come
-- prima, e la policy di insert non cambia. Chi rientra nella lista riprende
-- l'accesso come ogni altro membro.
--
-- Tutti i nomi sono qualificati, come vuole il search_path vuoto (#179), e la
-- funzione ha la sua revoca da PUBLIC (#160). Il guardiano è
-- supabase/tests/inherited_images_belong_to_list.test.sql.

-- 1. Se l'oggetto è stato ereditato da una lista di cui chi chiama non è
-- membro. La chiave di inherited_food_images è l'oggetto: una lista sola per
-- oggetto.
create function public.inherited_by_another_list(p_object_name text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select exists (
    select 1
    from public.inherited_food_images i
    where i.object_name = p_object_name
      and not exists (
        select 1 from public.get_user_list_ids() u where u.list_id = i.list_id
      )
  );
$$;

revoke execute on function public.inherited_by_another_list(text) from public, anon;
grant execute on function public.inherited_by_another_list(text) to authenticated;
grant execute on function public.inherited_by_another_list(text) to service_role;

-- 2. Le tre policy di lettura, sostituzione e rimozione. Le clausole di
-- cartella valgono solo per gli oggetti che non appartengono a un'altra lista;
-- per quelli resta can_access_inherited_image(), cioè i membri della lista che
-- li ha ereditati.
drop policy "Users can view own images or shared list images" on storage.objects;
create policy "Users can view own images or shared list images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (
        (
          (storage.foldername(name))[1] = auth.uid()::text
          or (storage.foldername(name))[1] in (
            select user_id::text from public.get_shared_list_member_ids()
          )
        )
        and not public.inherited_by_another_list(name)
      )
      or public.can_access_inherited_image(name)
    )
  );

drop policy "Users can update own images or shared list images" on storage.objects;
create policy "Users can update own images or shared list images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (
        (
          (storage.foldername(name))[1] = auth.uid()::text
          or (storage.foldername(name))[1] in (
            select user_id::text from public.get_shared_list_member_ids()
          )
        )
        and not public.inherited_by_another_list(name)
      )
      or public.can_access_inherited_image(name)
    )
  )
  with check (
    bucket_id = 'food-images'
    and (
      (
        (
          (storage.foldername(name))[1] = auth.uid()::text
          or (storage.foldername(name))[1] in (
            select user_id::text from public.get_shared_list_member_ids()
          )
        )
        and not public.inherited_by_another_list(name)
      )
      or public.can_access_inherited_image(name)
    )
  );

drop policy "Users can delete own images or shared list images" on storage.objects;
create policy "Users can delete own images or shared list images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (
        (
          (storage.foldername(name))[1] = auth.uid()::text
          or (storage.foldername(name))[1] in (
            select user_id::text from public.get_shared_list_member_ids()
          )
        )
        and not public.inherited_by_another_list(name)
      )
      or public.can_access_inherited_image(name)
    )
  );
