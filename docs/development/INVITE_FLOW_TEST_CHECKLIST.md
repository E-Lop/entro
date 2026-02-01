# 🧪 Checklist Test Flusso Inviti

**Scopo:** Verificare che il fix per il case sensitivity delle email funzioni correttamente
**File Modificati:** `src/lib/invites.ts`, `src/stores/authStore.ts`
**Data:** 2026-01-27

---

## ✅ Test 1: Registrazione con Email Mixed Case

### Obiettivo
Verificare che un utente con email "Test@Example.COM" venga correttamente aggiunto alla lista condivisa

### Prerequisiti
- [ ] Deploy del codice aggiornato
- [ ] Console browser aperta per vedere logs

### Steps
1. **Crea invito** (Utente A - l'invitante)
   ```
   - Login come utente esistente
   - Vai a Dashboard
   - Click su "Condividi Lista" o simile
   - Copia il codice invito (es. "ABC123")
   ```
   - [ ] Codice invito copiato: `__________`

2. **Registra nuovo utente con email mixed case** (Utente B)
   ```
   - Apri finestra incognito
   - Vai a /signup?code=ABC123
   - Email: "TestUser@Example.COM" (con maiuscole)
   - Password: qualsiasi
   - Click "Registra"
   ```
   - [ ] Messaggio "Controlla la tua email" mostrato
   - [ ] Email ricevuta

3. **Verifica normalizzazione in DB** (Opzionale)
   ```sql
   SELECT pending_user_email, short_code, status
   FROM invites
   WHERE short_code = 'ABC123';

   -- Atteso: pending_user_email = 'testuser@example.com' (lowercase)
   ```
   - [ ] Email nel DB è lowercase: `__________`

4. **Conferma email**
   ```
   - Apri link da email
   - Attendi redirect e login automatico
   ```
   - [ ] Login automatico avvenuto
   - [ ] Page reload eseguito

5. **Verifica risultato finale**
   ```
   - Dashboard mostra lista condivisa (NON vuota)
   - Vedi cibi dell'utente A
   - Toast "Benvenuto nella lista di [Nome A]" mostrato
   ```
   - [ ] ✅ Lista condivisa visibile
   - [ ] ✅ Cibi dell'invitante presenti
   - [ ] ✅ Welcome toast mostrato
   - [ ] ❌ FALLITO: Lista vuota (problema non risolto)

### Logs da Verificare in Console
```
Cerca in console browser:
[registerPendingInvite] Starting registration
[registerPendingInvite] Successfully registered
[acceptInviteByEmail] Starting invite acceptance
[acceptInviteByEmail] Found pending invite
[acceptInviteByEmail] Successfully added user to list
[authStore] Invite accepted successfully, reloading
```

- [ ] Tutti i log presenti e corretti
- [ ] Nessun errore nella console

---

## ✅ Test 2: Email Completamente Maiuscola

### Steps
1. Crea nuovo invito: `__________`
2. Registra con email: `ALLCAPS@DOMAIN.COM`
3. Conferma email
4. Verifica: lista condivisa visibile

- [ ] ✅ Test passed
- [ ] ❌ Test failed - Descrizione: `__________`

---

## ✅ Test 3: Email con Spazi Extra

### Steps
1. Crea nuovo invito: `__________`
2. Registra con email: `" user@domain.com "` (con spazi prima/dopo)
3. Conferma email
4. Verifica: lista condivisa visibile

- [ ] ✅ Test passed
- [ ] ❌ Test failed - Descrizione: `__________`

---

## ✅ Test 4: Invito Scaduto

### Obiettivo
Verificare che inviti scaduti vengano gestiti correttamente

### Steps
1. Crea invito manualmente nel DB
   ```sql
   INSERT INTO invites (list_id, created_by, short_code, expires_at, status)
   VALUES (
     'your-list-id',
     'your-user-id',
     'EXP123',
     NOW() - INTERVAL '1 day',  -- scaduto ieri
     'pending'
   );
   ```
2. Registra nuovo utente con codice `EXP123`
3. Conferma email
4. Verifica: messaggio "Invito scaduto" mostrato

### Log Atteso
```
[acceptInviteByEmail] Invite has expired: {...}
```

- [ ] ✅ Errore scadenza mostrato
- [ ] ✅ Lista personale creata come fallback
- [ ] ❌ Test failed

---

## ✅ Test 5: Utente Già Membro

### Obiettivo
Verificare che re-accept di invito non causi errori

### Steps
1. Utente B già nella lista condivisa
2. Crea nuovo invito per stessa lista
3. Utente B clicca nuovo link (anche se già membro)
4. Verifica: nessun errore, redirect a lista

### Log Atteso
```
[acceptInviteByEmail] User is already a member
```

- [ ] ✅ Nessun errore
- [ ] ✅ Lista mostrata correttamente
- [ ] ❌ Test failed

---

## ✅ Test 6: Click Multipli su Link Conferma

### Obiettivo
Verificare protezione contro doppia inizializzazione

### Steps
1. Registra nuovo utente con invito
2. Clicca link conferma email
3. **Mentre la pagina carica**, clicca di nuovo il link
4. Verifica: nessun errore, nessuna lista duplicata

### Log Atteso
```
[authStore] User already processed in this session, skipping
```

- [ ] ✅ Nessun errore
- [ ] ✅ Una sola lista creata
- [ ] ❌ Test failed

---

## 🐛 Test Errore 406 Originale

### Obiettivo
Verificare che errore 406 non si presenti più

### Steps
1. Registra nuovo utente con invito (email mixed case)
2. Conferma email
3. **Controlla Network tab** in DevTools durante il caricamento
4. Cerca richieste con status 406

- [ ] ✅ Nessun errore 406
- [ ] ❌ Errore 406 ancora presente

### Se Errore 406 Persiste
Verifica quale endpoint:
- URL: `__________`
- Method: `__________`
- Response: `__________`

---

## 📊 Risultati Complessivi

### Test Passati
- [ ] Test 1: Email Mixed Case
- [ ] Test 2: Email Maiuscola
- [ ] Test 3: Email con Spazi
- [ ] Test 4: Invito Scaduto
- [ ] Test 5: Utente Già Membro
- [ ] Test 6: Click Multipli
- [ ] Errore 406 Risolto

### Totale: ____/7

---

## 🔍 Debug: Se Test Fallisce

### 1. Verifica Database
```sql
-- Check invito pendente
SELECT * FROM invites
WHERE pending_user_email = 'testuser@example.com';

-- Check membership
SELECT * FROM list_members
WHERE user_id = 'user-id-from-test';
```

### 2. Verifica Logs Console
- Cerca errori con prefisso `[acceptInviteByEmail]`
- Cerca errori di RLS (Row Level Security)
- Cerca errori di network (406, 403, 401)

### 3. Verifica SessionStorage
```javascript
// In console browser
console.log(sessionStorage.getItem('user_initialized_testuser@example.com'))
// Atteso: 'true' dopo primo caricamento
```

### 4. Verifica Email Normalizzata
```javascript
// Test normalizzazione
const email = "Test@Example.COM"
const normalized = email.toLowerCase().trim()
console.log(normalized) // deve essere "test@example.com"
```

---

## 📝 Note Aggiuntive

### Ambiente di Test
- [ ] Development locale
- [ ] Staging
- [ ] Production

### Browser Testati
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Mobile Safari (iPhone)

### Casi Edge Non Testati
- [ ] Email con caratteri Unicode
- [ ] Email con + (plus addressing)
- [ ] Invito con più utenti contemporaneamente
- [ ] Network slow/intermittente

---

**Completato da:** `__________`
**Data:** `__________`
**Risultato:** [ ] ✅ Tutti i test passati  |  [ ] ⚠️ Alcuni test falliti  |  [ ] ❌ Fix non funzionante
