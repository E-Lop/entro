-- Hardening accesso a public.invites — issue #67
--
-- Problema: in produzione il ruolo `anon` aveva GRANT legacy ampi (retaggio
-- pre Data API hardening) e due policy RLS `USING (true)` su `invites`. La
-- combinazione permetteva a un client anonimo di leggere TUTTE le righe di
-- invites (token, short_code, email) e di aggiornarle.
--
-- Questa migration e' ADDITIVA (nessun DROP di colonne/tabelle, nessuna
-- perdita dati): sostituisce le policy permissive con versioni mirate, sposta
-- l'unico accesso anonimo legittimo dietro una funzione SECURITY DEFINER, e
-- revoca i privilegi legacy non necessari al ruolo `anon`.
--
-- Riferimenti: https://supabase.com/docs/guides/api/securing-your-api

-- 1) Caso d'uso anonimo legittimo -------------------------------------------
-- Durante il signup, prima della conferma email, il client (ancora anon)
-- registra la propria email su un invito pending individuato dallo short_code.
-- Con questa RPC l'anon non tocca piu' direttamente la tabella: la funzione
-- gira come definer e aggiorna solo la colonna pending_user_email.
create or replace function public.register_pending_invite(
  p_short_code text,
  p_email text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_short_code is null or p_email is null then
    return false;
  end if;

  update public.invites
    set pending_user_email = lower(trim(p_email))
  where short_code = upper(p_short_code)
    and status = 'pending'
    and expires_at > now();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

comment on function public.register_pending_invite(text, text) is
  'Registra pending_user_email su un invito pending individuato dallo short_code. Usata dal client anonimo durante il signup (issue #67), evita accesso diretto di anon alla tabella invites.';

grant execute on function public.register_pending_invite(text, text)
  to anon, authenticated, service_role;

-- 2) Policy mirate al posto delle due USING(true) ---------------------------
drop policy if exists "Public can read invites or list members can view their invites" on public.invites;
drop policy if exists "System can update invite status" on public.invites;
drop policy if exists "Authenticated can read pending or own-list invites" on public.invites;
drop policy if exists "Authenticated can update pending or own-list invites" on public.invites;

-- Lettura: solo utenti autenticati. Possono leggere gli inviti pending (per
-- accettarli tramite short_code / pending_user_email) e quelli delle liste di
-- cui sono membri. Il ruolo anon non legge piu' alcun invito.
create policy "Authenticated can read pending or own-list invites"
  on public.invites for select
  to authenticated
  using (
    status = 'pending'
    or list_id in (select public.get_user_list_ids())
  );

-- Aggiornamento: solo autenticati. Accettazione (pending -> accepted/expired)
-- oppure modifica degli inviti delle proprie liste. WITH CHECK impedisce di
-- lasciare l'invito in stato pending alterandone i campi (es. short_code) se
-- non appartiene a una propria lista.
--
-- NB (invariante "join prima, accept dopo"): questa WITH CHECK NON impedisce a
-- un non-membro di marcare accepted/expired un invito pending altrui (il ramo
-- status ammette entrambi). L'ordine corretto dei flussi accept e' garantito
-- dal CODICE, non da RLS: le UPDATE usano return=minimal (nessun RETURNING),
-- quindi la SELECT policy non viene applicata alla riga nuova. Restringere il
-- ramo status e' tracciato in #71 (non invertire l'ordine nel frattempo).
create policy "Authenticated can update pending or own-list invites"
  on public.invites for update
  to authenticated
  using (
    status = 'pending'
    or list_id in (select public.get_user_list_ids())
  )
  with check (
    status in ('accepted', 'expired')
    or list_id in (select public.get_user_list_ids())
  );

-- La policy "List members can create invites" (INSERT) resta invariata.

-- 3) Grant minimi -----------------------------------------------------------
-- anon non ha piu' alcun accesso diretto a invites: solo la RPC sopra.
revoke all privileges on public.invites from anon;

-- Difesa in profondita': revoca i privilegi legacy di scrittura di anon sulle
-- tabelle utente (in produzione esistono per default pre-hardening; in locale
-- sono per lo piu' no-op). Le policy RLS gia' negano le righe ad anon, ma il
-- principio del minimo privilegio richiede di togliere anche i GRANT.
revoke insert, update, delete, truncate, references on public.foods from anon;
revoke insert, update, delete, truncate, references on public.lists from anon;
revoke insert, update, delete, truncate, references on public.list_members from anon;
revoke insert, update, delete, truncate, references on public.categories from anon;
