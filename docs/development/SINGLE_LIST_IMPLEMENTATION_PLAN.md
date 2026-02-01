# Piano: Gestione Liste con Approccio Lista Singola

## Decisione Architetturale

**APPROCCIO SCELTO: Lista Singola per Utente**

### Regola Business
Un utente può appartenere a **UNA SOLA lista** alla volta. Accettare un invito a una lista condivisa significa rinunciare alla propria lista personale.

### Motivazione della Scelta

Basato sulle risposte:
- ✅ Caso d'uso principale: **Famiglia/coppia con 1 lista condivisa**
- ✅ Perdita dati accettabile con **avviso chiaro**
- ✅ Priorità: **Launch veloce** (1-2 giorni vs 1 settimana)

**Vantaggi:**
- Semplicità massima per l'utente (nessun selector liste)
- Mental model chiaro: "la mia lista" (personale o condivisa)
- Time-to-market ridotto (1.5-2 giorni)
- Codice minimale da modificare (4-5 file)
- Meno bugs, meno testing necessario
- Database già supporta liste multiple → migration path aperto per il futuro

**Trade-off accettato:**
- Perdita dati quando utente accetta invito (mitigato con dialog di conferma)
- Nessuna flessibilità per "power users" con multiple liste (use case minoritario)

---

## Comportamento Sistema

### Scenario 1: Nuovo Utente SENZA Invito
1. Utente fa signup
2. Al primo login: `createPersonalList()` crea "La mia lista"
3. Utente ha 1 lista personale

### Scenario 2: Nuovo Utente CON Invito
1. Utente riceve link invito o codice (es: "ABC123")
2. Fa signup con codice → `registerPendingInvite()` salva email
3. Conferma email + login → `acceptInviteByEmail()` aggiunge a lista condivisa
4. **NON crea lista personale** (skip `createPersonalList()`)
5. Utente ha 1 lista condivisa

### Scenario 3: Utente Esistente Accetta Invito ⚠️ CRITICO
1. Utente ha già lista personale con N cibi
2. Riceve link invito o inserisce codice
3. **DIALOG DI CONFERMA appare:**
   ```
   "Accettando questo invito rinuncerai alla tua lista personale.
    Tutti i tuoi alimenti (N cibi) saranno eliminati.
    Vuoi continuare?"

    [Annulla] [Conferma e Unisciti]
   ```
4. Se utente CONFERMA:
   - Rimuovi utente da `list_members` (lista personale)
   - Se lista personale ha 0 membri rimasti → DELETE lista + tutti i foods associati (CASCADE)
   - Aggiungi utente a `list_members` (lista condivisa)
   - Toast success: "Ti sei unito alla lista condivisa!"
   - Reload app → mostra cibi della nuova lista
5. Se utente ANNULLA:
   - Nessun cambiamento
   - Mantiene lista personale

---

## File da Modificare - Riepilogo

### File Nuovi
1. ✨ `src/components/sharing/AcceptInviteDialog.tsx` (~100 righe)
   - Dialog conferma accettazione invito con warning perdita dati

2. ✨ `src/components/sharing/InviteMenuDialog.tsx` (~120 righe)
   - Menu principale con 3 opzioni (crea/accetta/abbandona)

3. ✨ `src/components/sharing/AcceptInviteFlowDialog.tsx` (~80 righe)
   - Input codice + flow accettazione

4. ✨ `src/components/sharing/LeaveListDialog.tsx` (~80 righe)
   - Dialog abbandono lista condivisa

5. ✨ `src/pages/JoinPage.tsx` (~40 righe)
   - Route `/join/:code` per link esterni

### File Modificati
1. 📝 `src/lib/invites.ts` (+120 righe)
   - `acceptInviteWithConfirmation()` - accept con conferma
   - `leaveSharedList()` - abbandona lista condivisa

2. 📝 `src/components/sharing/InviteButton.tsx` (~5 righe)
   - Cambia testo da "Invita membro" a "Inviti"
   - Cambia icona da UserPlus a Mail

3. 📝 `src/components/layout/AppLayout.tsx` (+15 righe)
   - Import InviteMenuDialog
   - State isInSharedList
   - useEffect check lista condivisa
   - Usa InviteMenuDialog invece di InviteDialog

4. 📝 `src/types/invite.types.ts` (+10 righe)
   - Type `AcceptInviteConfirmationResponse`

5. 📝 `src/router.tsx` (+4 righe)
   - Route `/join/:code`

**Totale:** 10 file (5 nuovi, 5 modificati)

---

## Stima Implementazione

### Effort
- **Coding:** 1.5 giorni
- **Testing:** 0.5 giorni
- **Totale:** 2 giorni

### Breakdown
- Fase 1: Backend logic acceptInviteWithConfirmation (2 ore)
- Fase 2: AcceptInviteDialog UI (2 ore)
- Fase 3: InviteMenuDialog + AcceptInviteFlowDialog + LeaveListDialog (3 ore)
- Fase 3: AppLayout integration + isInSharedList check (1 ora)
- Fase 4: JoinPage route (1 ora)
- Fase 5: leaveSharedList() backend (1 ora)
- Fase 7: Types (15 min)
- Testing completo (4 ore)
- Polish UI e edge cases (1 ora)

---

## Mobile-First UX Guidelines

**PRIORITÀ: L'app è una PWA usata principalmente su smartphone. Tutti i componenti devono essere mobile-friendly.**

### Dialog Design
- ✅ **Responsive**: Dialog usano classi responsive (max-w-lg, sm:max-w-xl)
- ✅ **Touch-friendly**: Bottoni min-height 44px (standard iOS/Android)
- ✅ **Fullscreen mobile**: Su schermi <640px dialog occupano quasi tutto lo schermo
- ✅ **Scroll**: DialogContent con max-height e overflow-y-auto

### Input Codice (AcceptInviteFlowDialog)
```tsx
<Input
  placeholder="ABC123"
  className="text-center text-xl tracking-widest font-mono h-14"
  // Font grande (text-xl), altezza generosa (h-14), spaziatura per leggibilità
  maxLength={6}
  autoFocus
  autoComplete="off"
  inputMode="text"  // Tastiera alfabetica su mobile
/>
```

### Bottoni
- ✅ **Touch target**: min 44x44px (standard accessibilità)
- ✅ **Spaziatura**: gap-3 tra bottoni (48px)
- ✅ **Feedback**: Active states visibili (scale-95 al tap)
- ✅ **Loading states**: Spinner + testo "Caricamento..." (non solo icona)

### Menu Dropdown
- ✅ **InviteMenuDialog** opzioni con padding generoso (p-4)
- ✅ **Icone grandi**: h-5 w-5 (20px) ben visibili
- ✅ **Testo descrittivo**: text-xs per context senza bisogno di tooltip

---

## Note Finali

### Principi Seguiti
1. **YAGNI** - Implementare solo ciò che serve ora
2. **Semplicità** - Mental model chiaro per utente
3. **Sicurezza** - Dialog conferma previene perdita dati accidentale
4. **Scalabilità** - Database pronto per evoluzione futura
5. **Mobile-First** - UI ottimizzata per smartphone (touch, grandi tap target)

### Rischi Mitigati
- ✅ Perdita dati accidentale → Dialog conferma con count cibi
- ✅ Confusione utente → Flow chiaro, messaggi espliciti
- ✅ Bug duplicate members → Check in backend
- ✅ Utente senza lista → Validazione in `leaveList()`

### Next Steps Dopo Implementazione
1. Monitorare metriche: % utenti che accettano inviti
2. Raccogliere feedback: utenti vogliono liste multiple?
3. Decidere se/quando implementare Approccio 2 in base a dati reali

---

## Implementazione Completa

Per i dettagli completi dell'implementazione (codice sorgente completo per ogni fase), vedere il file del piano originale: `/Users/edmondo/.claude/plans/rosy-fluttering-waterfall.md`
