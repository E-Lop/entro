-- #194 — Chi ha creato un invito lo può cancellare, in qualunque stato.
--
-- Fino a oggi un invito non si ritirava: nessuna policy di DELETE su invites
-- (l'UPDATE era stato tolto dalla 20260720), e un invito pending restava
-- valido 7 giorni per chiunque avesse il codice. Le righe restavano per
-- sempre: sparivano solo con la lista o con l'account di chi le aveva create.
--
-- Decisioni del maintainer (28 set 2026): revoca vera, e il creatore cancella
-- in qualunque stato. Pending è una revoca: il codice non si valida più e non
-- fa entrare, con gli stessi esiti di un codice inesistente. Accettato o
-- scaduto è pulizia: chi è entrato resta nella lista. Gli inviti degli altri
-- membri della stessa lista restano intoccabili.
--
-- Una policy e non una RPC, perché la cancellazione non ha effetti
-- collaterali: nessuna tabella punta a invites. Il grant DELETE ad
-- authenticated c'è già; lo si ridichiara perché la policy senza grant non
-- servirebbe a niente. Il guardiano è supabase/tests/invite_revocation.test.sql.

grant delete on public.invites to authenticated;

create policy "Creators can delete their invites"
  on public.invites for delete
  to authenticated
  using (created_by = auth.uid());
