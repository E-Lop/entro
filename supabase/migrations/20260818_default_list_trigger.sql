-- La lista personale nasce con l'utente, nel database (#94).
--
-- `public.create_default_list_for_user()` esisteva dalla migrazione baseline —
-- completa, con tanto di rispetto per gli inviti pendenti — ma **nessun trigger
-- la chiamava**: `git log -S "on auth.users"` su `supabase/` non trova nulla, e
-- fra i trigger applicativi c'era solo `update_foods_updated_at`. Era una
-- funzione orfana, e il commento in `src/lib/foods.ts` che dava per esistente
-- un «auto-creation trigger» descriveva un meccanismo mai collegato.
--
-- Nel frattempo la lista la creava il client, dopo l'accesso, con la RPC
-- `create_personal_list`. Funziona quasi sempre, e per questo il buco è rimasto
-- invisibile per mesi. Ma è asincrona: finché non risponde l'utente non ha una
-- lista, e la policy di inserimento su `foods` pretende `list_id is not null`
-- con appartenenza — quindi ogni salvataggio in quella finestra viene rifiutato
-- con `new row violates row-level security policy`. Se poi l'RPC **fallisce**,
-- `authStore` marca il tentativo come fatto per non rientrare e l'utente resta
-- senza lista per l'intera sessione: non una finestra, uno stato.
--
-- Collegare il trigger sposta la creazione dove non può correre con la UI, e
-- vale anche per entro-mobile, che condivide questo backend. Il percorso client
-- resta, ma da qui in poi è una rete di sicurezza e non il meccanismo primario.

-- 1. La funzione, irrobustita.
--
-- Due cose che mancavano e che la convenzione di famiglia
-- `security-definer-rpc-gating` rende obbligatorie: `set search_path = ''` con
-- riferimenti qualificati — senza, una `security definer` è un vettore di
-- privilege escalation — e una gestione dell'errore.
--
-- L'errore va gestito perché questo trigger sta sul percorso della
-- **registrazione**: se solleva, l'utente non riesce a iscriversi. Fra due mali
-- si sceglie quello reversibile — nessuna lista, con il percorso client che
-- resta a rimediare — invece di bloccare l'accesso al prodotto. Il `warning`
-- finisce nei log di Postgres, quindi il fallimento non è muto.
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
begin
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

-- 2. Il trigger che mancava.
--
-- `drop if exists` prima di creare: se in produzione qualcuno lo avesse creato
-- a mano dalla dashboard — deriva fra schema reale e migrazioni che da qui non
-- si può escludere — questa migrazione lo riallinea invece di fallire.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.create_default_list_for_user();

-- 3. Gli utenti che una lista non ce l'hanno mai avuta.
--
-- Il trigger vale solo da adesso in avanti. Chi è passato da un fallimento
-- della RPC lato client è rimasto senza, e nessuno se ne sarebbe accorto:
-- l'app non lo dice, mostra solo il rifiuto della RLS al primo salvataggio.
-- Naturalmente idempotente — tocca solo chi non ha già un'appartenenza — e si
-- ferma sugli inviti pendenti con la stessa regola del trigger.
with senza_lista as (
  select
    u.id,
    concat('Lista di ', coalesce(u.raw_user_meta_data->>'full_name', u.email)) as list_name
  from auth.users u
  where not exists (
      select 1 from public.list_members lm where lm.user_id = u.id
    )
    and not exists (
      select 1 from public.invites i
      where i.email = u.email
        and i.status = 'pending'
        and i.expires_at > now()
    )
),
liste_create as (
  insert into public.lists (created_by, name)
  select id, list_name from senza_lista
  returning id as new_list_id, created_by
)
insert into public.list_members (list_id, user_id)
select new_list_id, created_by from liste_create;
