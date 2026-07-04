-- Baseline ricostruttiva dello schema core Entro prima delle migration push.
--
-- Origine: lettura sola produzione Supabase project rmbmmwcxtnanacxbkihc
-- aggiornata il 2026-07-03.
--
-- ATTENZIONE:
-- - Non applicare questa migration in produzione: gli oggetti esistono gia'.
-- - Serve per rendere `supabase db reset` riproducibile da clone pulito.
-- - Prima di qualunque `supabase db push`, marcare questa baseline come applied
--   nella history remota con `supabase migration repair`.

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  name_it text not null,
  icon text not null,
  color text not null,
  default_storage text not null check (default_storage = any (array['fridge'::text, 'freezer'::text, 'pantry'::text])),
  average_shelf_life_days integer not null default 7,
  created_at timestamptz default now()
);

insert into public.categories (name, name_it, icon, color, default_storage, average_shelf_life_days) values
  ('bakery', 'Pane e Pasta', 'wheat', '#D97706', 'pantry', 3),
  ('beverages', 'Bevande', 'cup-soda', '#8B5CF6', 'pantry', 180),
  ('condiments', 'Condimenti', 'soup', '#F97316', 'pantry', 365),
  ('dairy', 'Latticini', 'milk', '#3B82F6', 'fridge', 7),
  ('fish', 'Pesce', 'fish', '#06B6D4', 'fridge', 2),
  ('frozen', 'Surgelati', 'snowflake', '#0EA5E9', 'freezer', 90),
  ('fruits', 'Frutta', 'apple', '#F59E0B', 'fridge', 5),
  ('meat', 'Carne', 'beef', '#EF4444', 'fridge', 3),
  ('other', 'Altro', 'package', '#6B7280', 'pantry', 7),
  ('snacks', 'Snack', 'candy', '#EC4899', 'pantry', 30),
  ('vegetables', 'Verdura', 'carrot', '#10B981', 'fridge', 7)
on conflict (name) do update set
  name_it = excluded.name_it,
  icon = excluded.icon,
  color = excluded.color,
  default_storage = excluded.default_storage,
  average_shelf_life_days = excluded.average_shelf_life_days;

create table public.lists (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'La mia lista',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.lists is 'Shared lists that can be accessed by multiple users';
comment on column public.lists.name is 'Display name for the list';
comment on column public.lists.created_by is 'User who created the list';

create index idx_lists_created_by on public.lists(created_by);

create table public.list_members (
  id uuid default gen_random_uuid() primary key,
  list_id uuid not null references public.lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (list_id, user_id)
);

comment on table public.list_members is 'Junction table tracking which users belong to which lists';
comment on column public.list_members.joined_at is 'When the user joined this list';

create index idx_list_members_list_id on public.list_members(list_id);
create index idx_list_members_user_id on public.list_members(user_id);

create table public.invites (
  id uuid default gen_random_uuid() primary key,
  list_id uuid not null references public.lists(id) on delete cascade,
  email text,
  token text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status = any (array['pending'::text, 'accepted'::text, 'expired'::text])),
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  short_code varchar(8),
  pending_user_email varchar(255),
  constraint valid_expiry check (expires_at > created_at)
);

comment on table public.invites is 'Invite tokens for sharing lists with new users';
comment on column public.invites.email is 'Email is now optional - invites can be anonymous and shared with anyone';
comment on column public.invites.token is 'Unique invite token (32 characters, nanoid)';
comment on column public.invites.status is 'pending = not yet accepted, accepted = user joined, expired = past expiry date';
comment on column public.invites.expires_at is 'Token expires after 7 days by default';
comment on column public.invites.short_code is 'Short 6-character alphanumeric code for easy sharing (e.g., ABC123)';
comment on column public.invites.pending_user_email is 'Email of user who signed up with this invite but has not yet confirmed email';

create index idx_invites_token on public.invites(token);
create index idx_invites_email on public.invites(email) where status = 'pending';
create index idx_invites_list_id on public.invites(list_id);
create unique index idx_invites_short_code on public.invites(short_code);
create index idx_invites_pending_user_email on public.invites(pending_user_email) where pending_user_email is not null;

create table public.foods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric(10, 2),
  quantity_unit text check (quantity_unit = any (array['pz'::text, 'kg'::text, 'g'::text, 'l'::text, 'ml'::text, 'confezioni'::text])),
  expiry_date date not null,
  category_id uuid not null references public.categories(id),
  storage_location text not null check (storage_location = any (array['fridge'::text, 'freezer'::text, 'pantry'::text])),
  image_url text,
  barcode text,
  notes text,
  status text default 'active' check (status = any (array['active'::text, 'consumed'::text, 'expired'::text, 'wasted'::text])),
  consumed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  list_id uuid references public.lists(id) on delete cascade,
  constraint positive_quantity check (quantity > 0::numeric)
);

comment on column public.foods.list_id is 'NULL = personal food (legacy), UUID = shared list food';

create index idx_foods_user_id on public.foods(user_id);
create index idx_foods_expiry_date on public.foods(expiry_date);
create index idx_foods_user_expiry on public.foods(user_id, expiry_date) where deleted_at is null;
create index idx_foods_category on public.foods(category_id);
create index idx_foods_storage on public.foods(storage_location);
create index idx_foods_barcode on public.foods(barcode) where barcode is not null;
create index idx_foods_status on public.foods(status);
create index idx_foods_name_search on public.foods using gin(to_tsvector('italian'::regconfig, name));
create index idx_foods_list_id on public.foods(list_id) where list_id is not null;
create index idx_foods_list_expiry on public.foods(list_id, expiry_date) where deleted_at is null and list_id is not null;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_foods_updated_at
  before update on public.foods
  for each row
  execute function public.update_updated_at_column();

create or replace function public.get_user_list_ids()
returns table (list_id uuid)
language sql
stable
security definer
as $$
  select distinct lm.list_id
  from public.list_members lm
  where lm.user_id = auth.uid();
$$;

create or replace function public.get_shared_list_member_ids()
returns table (user_id uuid)
language sql
stable
security definer
as $$
  select distinct lm.user_id
  from public.list_members lm
  where lm.list_id in (
    select list_members.list_id
    from public.list_members
    where list_members.user_id = auth.uid()
  );
$$;

create or replace function public.create_default_list_for_user()
returns trigger
language plpgsql
security definer
as $$
declare
  new_list_id uuid;
  pending_invite_count integer;
  list_name text;
begin
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
end;
$$;

create or replace function public.create_personal_list()
returns table (list_id uuid, success boolean, error_message text)
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_existing_list_id uuid;
  v_new_list_id uuid;
  v_list_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    return query select null::uuid, false, 'User not authenticated'::text;
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
    return query select null::uuid, false, sqlerrm::text;
end;
$$;

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.foods where user_id = current_user_id;

  delete from public.invites
  where created_by = current_user_id
     or pending_user_email = (
       select email from auth.users where id = current_user_id
     );

  delete from public.list_members where user_id = current_user_id;

  delete from public.lists
  where created_by = current_user_id
    and not exists (
      select 1 from public.list_members where list_id = lists.id
    );

  delete from auth.users where id = current_user_id;
end;
$$;

alter table public.categories enable row level security;
alter table public.foods enable row level security;
alter table public.lists enable row level security;
alter table public.list_members enable row level security;
alter table public.invites enable row level security;

create policy "Categories are publicly readable"
  on public.categories for select
  using (true);

create policy "Users can view lists they belong to"
  on public.lists for select
  using (id in (select public.get_user_list_ids()));

create policy "Users can create their own lists"
  on public.lists for insert
  with check (auth.uid() = created_by);

create policy "List members can update list details"
  on public.lists for update
  using (id in (select public.get_user_list_ids()));

create policy "Users can view members of their lists"
  on public.list_members for select
  using (
    user_id = auth.uid()
    or list_id in (select public.get_user_list_ids())
  );

create policy "Users can add themselves to a list via invite"
  on public.list_members for insert
  with check (auth.uid() = user_id);

create policy "Users can remove themselves from lists"
  on public.list_members for delete
  using (auth.uid() = user_id);

create policy "Public can read invites or list members can view their invites"
  on public.invites for select
  using (true);

create policy "List members can create invites"
  on public.invites for insert
  with check (
    auth.uid() = created_by
    and list_id in (select public.get_user_list_ids())
  );

create policy "System can update invite status"
  on public.invites for update
  using (true);

create policy "Users can view foods from their lists"
  on public.foods for select
  using (list_id in (
    select list_members.list_id
    from public.list_members
    where list_members.user_id = auth.uid()
  ));

create policy "Users can insert foods to their lists"
  on public.foods for insert
  with check (
    list_id is not null
    and list_id in (
      select list_members.list_id
      from public.list_members
      where list_members.user_id = auth.uid()
    )
  );

create policy "Users can update foods from their lists"
  on public.foods for update
  using (list_id in (
    select list_members.list_id
    from public.list_members
    where list_members.user_id = auth.uid()
  ))
  with check (list_id in (
    select list_members.list_id
    from public.list_members
    where list_members.user_id = auth.uid()
  ));

create policy "Users can delete foods from their lists"
  on public.foods for delete
  using (list_id in (
    select list_members.list_id
    from public.list_members
    where list_members.user_id = auth.uid()
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-images',
  'food-images',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload images to own folder or shared list folders"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
    )
  );

create policy "Users can view own images or shared list images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
    )
  );

create policy "Users can update own images or shared list images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
    )
  )
  with check (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
    )
  );

create policy "Users can delete own images or shared list images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'food-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text from public.get_shared_list_member_ids()
      )
    )
  );

alter publication supabase_realtime add table public.foods;

grant select on public.categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.foods to authenticated, service_role;
grant select, insert, update, delete on public.lists to authenticated, service_role;
grant select, insert, update, delete on public.list_members to authenticated, service_role;
grant select, insert, update, delete on public.invites to authenticated, service_role;
grant select on public.invites to anon;

grant execute on function public.get_user_list_ids() to authenticated, service_role;
grant execute on function public.get_shared_list_member_ids() to authenticated, service_role;
grant execute on function public.create_personal_list() to authenticated, service_role;
grant execute on function public.delete_user() to authenticated, service_role;

revoke execute on function public.delete_user() from anon;
