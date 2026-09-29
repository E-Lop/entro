-- #184, seconda metà («contract»): authenticated non cancella più righe di
-- list_members.
--
-- Si esce da una lista solo con leave_list() (20260929130000), che toglie la
-- riga e crea la lista personale nella stessa transazione, e rifiuta chi è
-- l'unico membro. Con il DELETE diretto un utente poteva uscire dalla propria
-- lista personale e lasciarla orfana e invisibile, con gli alimenti dentro.
--
-- Va in produzione dopo i client che usano leave_list(): la PWA v1.14.3,
-- servita da entroapp.it il 29 set 2026, ed entro-mobile#204. Un client più
-- vecchio che prova a uscire riceve un errore di permesso, e la frase a
-- schermo è quella generica.
--
-- Le funzioni SECURITY DEFINER che cancellano righe (join_list_via_invite,
-- leave_list, il trigger di cancellazione dell'account) girano come
-- proprietario e non ne risentono. Il guardiano è
-- supabase/tests/list_members_no_direct_delete.test.sql.

drop policy "Users can remove themselves from lists" on public.list_members;
revoke delete on public.list_members from authenticated, anon;
