-- ============================================
-- Deriva fra il repo e la produzione: corpo e COMMENT (#182)
--
-- Inventario del 12 nov 2026 nella #182, misurato con
-- `supabase db diff --linked --use-pg-delta`. Questa migrazione chiude le
-- voci «riallineate»; quelle dichiarate (pg_cron, pg_net, il job delle
-- notifiche) restano all'ambiente.
--
-- 1. update_updated_at_column(): in produzione il corpo ha le parole in
--    maiuscolo. Fa la stessa cosa, quindi non è sbagliato e il repo si
--    adegua: il testo qui sotto è quello di produzione, spazi compresi,
--    perché pg-delta confronta il testo. CREATE OR REPLACE non cambia
--    proprietario né permessi della funzione.
-- 2. I COMMENT di tre colonne di invites: in produzione hanno a capo e spazi
--    a metà frase, residui di un incolla. Vince il testo pulito del repo.
-- 3. I COMMENT di create_personal_list() e delle tre policy di foods: in
--    produzione c'erano, nel repo no.
-- 4. Il COMMENT di delete_user(): quello di produzione diceva che la funzione
--    cancella tutti i dati e gli inviti. Dalla 20260922 la funzione cancella
--    solo l'utente, e il resto lo fa il trigger on_auth_user_deleted, che
--    lascia le liste condivise agli altri membri. Testo nuovo, vero per oggi.
-- ============================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

comment on column public.invites.email is 'Email is now optional - invites can be anonymous and shared with anyone';
comment on column public.invites.short_code is 'Short 6-character alphanumeric code for easy sharing (e.g., ABC123)';
comment on column public.invites.pending_user_email is 'Email of user who signed up with this invite but has not yet confirmed email';

comment on function public.create_personal_list() is 'Creates a personal list for the authenticated user if they don''t have one yet.
Returns the list_id and success status. Safe to call multiple times (idempotent).
Runs with SECURITY DEFINER to bypass RLS and ensure reliable access to auth.uid().';

comment on function public.delete_user() is 'Deletes the calling user''s account (GDPR Article 17, right to erasure). The cleanup runs in the on_auth_user_deleted trigger, on every deletion path: lists left without other members, foods without a list, invites the user created or was invited by email to. Shared lists and the foods created in them stay with the other members.';

comment on policy "Users can view foods from their lists" on public.foods is 'Users can only view foods from lists they are currently members of. Removed user_id check to prevent stale data visibility.';
comment on policy "Users can update foods from their lists" on public.foods is 'Users can only update foods from their current lists.';
comment on policy "Users can delete foods from their lists" on public.foods is 'Users can only delete foods from their current lists.';
