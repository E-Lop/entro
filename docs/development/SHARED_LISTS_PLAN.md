# Piano di Implementazione: Shared Lists Multi-User

---

## ⚠️ NOTA IMPORTANTE - PIANO SUPERSEDED

**Data:** 21 Gennaio 2026

Questo piano descrive un approccio basato su **inviti via email** che è stato **sostituito** da un nuovo approccio più semplice e mobile-friendly.

**Nuovo Piano Raccomandato:** [SHORT_CODE_INVITES_PLAN.md](SHORT_CODE_INVITES_PLAN.md)

### Perché il Cambio?
Il sistema email-based presentava problemi di UX su mobile:
- ❌ Link lunghi (80+ caratteri) non copiabili facilmente da toast
- ❌ Token 32 caratteri difficile da condividere manualmente
- ❌ Dipendenza da servizio email esterno (Resend)

### Nuovo Approccio (Short Code)
Il nuovo piano introduce:
- ✅ Codici brevi 6 caratteri (es: `ABC123`)
- ✅ URL brevi: `/join/ABC123`
- ✅ Web Share API per condivisione nativa mobile
- ✅ Completamente anonimo (no email requirement)
- ✅ Zero costi ricorrenti (no email service)
- ✅ Stima: 5-6 ore implementazione (molto più veloce!)

**Questo documento rimane come riferimento storico per l'architettura database (liste, list_members, invites), ma l'implementazione degli inviti segue il nuovo piano.**

---

## Obiettivo (Originale)
Implementare un sistema semplificato di condivisione liste per permettere a più persone (es. famiglia) di gestire insieme la stessa lista di alimenti, con pari permessi e senza complessità di gestione ruoli.

## Modello Semplificato
- **Household Sharing:** Tutti i membri hanno pari accesso (no owner/editor/viewer roles)
- **Single Shared List:** Ogni utente appartiene a una sola lista condivisa
- **Invite Flow:** Email → Signup → Auto-join lista del mittente
- **Solo Lista Condivisa:** ✅ Chi accetta un invito NON ha una lista personale separata, accede SOLO alla lista condivisa
- **Feature Flag:** ✅ `VITE_ENABLE_SHARED_LISTS` per rollout graduale e possibilità di rollback

## Architettura Scelta: Approach A (Backward Compatible)

### Perché questa scelta?
- Mantiene `user_id` per compatibilità con utenti esistenti
- Aggiunge `list_id` nullable per supportare liste condivise
- Zero breaking changes per utenti attuali
- Migrazione graduale e sicura

## 1. Schema Database - Nuove Tabelle

### Tabella `lists` (Liste Condivise)
```sql
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'La mia lista',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lists_created_by ON lists(created_by);
```

### Tabella `list_members` (Chi appartiene a quali liste)
```sql
CREATE TABLE list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_list_members_list_id ON list_members(list_id);
CREATE INDEX idx_list_members_user_id ON list_members(user_id);
```

### Tabella `invites` (Gestione Inviti)
```sql
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email) WHERE status = 'pending';
CREATE INDEX idx_invites_list_id ON invites(list_id);
```

## 2. Modifica Tabella Esistente `foods`

```sql
-- Aggiunge list_id (nullable per backward compatibility)
ALTER TABLE foods
ADD COLUMN list_id UUID REFERENCES lists(id) ON DELETE CASCADE;

-- Indici per performance
CREATE INDEX idx_foods_list_id ON foods(list_id) WHERE list_id IS NOT NULL;
CREATE INDEX idx_foods_list_expiry ON foods(list_id, expiry_date)
  WHERE deleted_at IS NULL AND list_id IS NOT NULL;
```

**Logica:**
- `list_id = NULL` → Alimento personale (legacy, utenti esistenti)
- `list_id = <uuid>` → Alimento condiviso (nuova feature)
- `user_id` rimane per tracciare chi ha creato l'alimento

## 3. RLS Policies - Aggiornamento

### Policies Tabelle Nuove

**`lists` table:**
```sql
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Utenti vedono liste di cui sono membri
CREATE POLICY "Users can view lists they belong to"
  ON lists FOR SELECT
  USING (
    id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Utenti possono creare liste
CREATE POLICY "Users can create their own lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Membri possono modificare dettagli lista
CREATE POLICY "List members can update list details"
  ON lists FOR UPDATE
  USING (
    id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );
```

**`list_members` table:**
```sql
ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- Membri vedono altri membri della stessa lista
CREATE POLICY "Users can view members of their lists"
  ON list_members FOR SELECT
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Utenti possono aggiungersi a liste (via invito)
CREATE POLICY "Users can add themselves to a list via invite"
  ON list_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**`invites` table:**
```sql
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Membri vedono inviti per le loro liste
CREATE POLICY "Users can view invites for their lists"
  ON invites FOR SELECT
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Membri possono creare inviti
CREATE POLICY "List members can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Validazione pubblica token (per signup)
CREATE POLICY "Anyone can validate invite tokens"
  ON invites FOR SELECT
  USING (true);

-- Sistema può aggiornare status
CREATE POLICY "System can update invite status"
  ON invites FOR UPDATE
  USING (true);
```

### Policies Tabella `foods` - SOSTITUZIONE COMPLETA

```sql
-- Drop policies esistenti
DROP POLICY "Users can view own foods" ON foods;
DROP POLICY "Users can insert own foods" ON foods;
DROP POLICY "Users can update own foods" ON foods;
DROP POLICY "Users can delete own foods" ON foods;

-- Nuove policies: supportano sia personal che shared

-- SELECT: Propri alimenti O alimenti di liste condivise
CREATE POLICY "Users can view own foods or shared list foods"
  ON foods FOR SELECT
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- INSERT: Creare alimenti personali O in liste condivise
CREATE POLICY "Users can insert foods to own account or shared lists"
  ON foods FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND list_id IS NULL) OR
    (list_id IS NOT NULL AND list_id IN (
      SELECT list_id FROM list_members WHERE user_id = auth.uid()
    ))
  );

-- UPDATE: Modificare propri alimenti O alimenti in liste condivise
CREATE POLICY "Users can update own foods or shared list foods"
  ON foods FOR UPDATE
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- DELETE: Eliminare propri alimenti O alimenti in liste condivise
CREATE POLICY "Users can delete own foods or shared list foods"
  ON foods FOR DELETE
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );
```

## 4. Storage Policies - Aggiornamento

```sql
-- Drop policies esistenti
DROP POLICY "Users can upload own food images" ON storage.objects;
DROP POLICY "Users can view own food images" ON storage.objects;
DROP POLICY "Users can update own food images" ON storage.objects;
DROP POLICY "Users can delete own food images" ON storage.objects;

-- Nuove policies: path rimane {user_id}/{filename},
-- ma membri di liste condivise possono accedere alle immagini del creator

CREATE POLICY "Users can upload images to own folder or shared list folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can view own images or shared list images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can update own images or shared list images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
)
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete own images or shared list images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
);
```

## 5. Migrazione Dati Esistenti

### Auto-creazione Lista per Nuovi Utenti
```sql
-- Trigger: ogni nuovo utente ottiene automaticamente una lista
-- ECCETTO se ha un invite pending (in quel caso unirà la lista esistente)
CREATE OR REPLACE FUNCTION create_default_list_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_list_id UUID;
  pending_invite_count INTEGER;
BEGIN
  -- Controlla se utente ha un invite pending
  SELECT COUNT(*) INTO pending_invite_count
  FROM invites
  WHERE email = NEW.email AND status = 'pending' AND expires_at > NOW();

  -- Crea lista SOLO se non ha inviti pending
  IF pending_invite_count = 0 THEN
    -- Crea lista
    INSERT INTO lists (created_by, name)
    VALUES (NEW.id, 'La mia lista')
    RETURNING id INTO new_list_id;

    -- Aggiungi utente come membro
    INSERT INTO list_members (list_id, user_id)
    VALUES (new_list_id, NEW.id);
  END IF;
  -- Se ha invite pending, acceptInvite() gestirà l'aggiunta alla lista

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_list_for_user();
```

### Backfill per Utenti Esistenti (One-time Migration)
```sql
-- Eseguire UNA SOLA VOLTA dopo deploy
DO $$
DECLARE
  user_record RECORD;
  new_list_id UUID;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    -- Skip se utente ha già una lista (es. utente invitato senza lista personale)
    IF NOT EXISTS (SELECT 1 FROM list_members WHERE user_id = user_record.id) THEN
      -- Crea lista per ogni utente esistente
      INSERT INTO lists (created_by, name)
      VALUES (user_record.id, 'La mia lista')
      RETURNING id INTO new_list_id;

      -- Aggiungi utente come membro
      INSERT INTO list_members (list_id, user_id)
      VALUES (new_list_id, user_record.id);

      -- Migra alimenti esistenti alla nuova lista
      UPDATE foods
      SET list_id = new_list_id
      WHERE user_id = user_record.id AND list_id IS NULL;
    END IF;
  END LOOP;
END $$;
```

**IMPORTANTE:** Gli utenti invitati NON riceveranno una lista personale al signup. Il trigger `create_default_list_for_user()` deve essere modificato per NON creare liste se l'utente ha già un invite pending.

## 6. Backend - Supabase Edge Functions

### Scelta Email Service: Supabase Auth Email (Built-in) ✅
Useremo il sistema integrato di Supabase Auth con `admin.inviteUserByEmail()`:
- ✅ Nessun costo aggiuntivo
- ✅ Zero configurazione esterna
- ✅ Template email personalizzabili nel dashboard
- ⚠️ Richiede configurazione SMTP in Supabase (se non già fatto)

### Edge Function: `create-invite`
**Path:** `supabase/functions/create-invite/index.ts`

**Responsabilità:**
- Valida che utente sia membro della lista
- Genera token sicuro (32 caratteri random)
- Crea record in tabella `invites`
- Invia email tramite `supabase.auth.admin.inviteUserByEmail()`
- Ritorna successo/errore

**Endpoint:** `POST /functions/v1/create-invite`
**Body:** `{ email: string, listId: string }`
**Response:** `{ success: boolean, invite: Invite | null }`

### Edge Function: `validate-invite`
**Path:** `supabase/functions/validate-invite/index.ts`

**Responsabilità:**
- Cerca invite con token fornito
- Verifica status = 'pending'
- Verifica scadenza (expires_at > NOW())
- Aggiorna status a 'expired' se scaduto
- Ritorna info lista senza autenticazione

**Endpoint:** `POST /functions/v1/validate-invite`
**Body:** `{ token: string }`
**Response:** `{ valid: boolean, invite: { email, listName } | null }`

### Edge Function: `accept-invite`
**Path:** `supabase/functions/accept-invite/index.ts`

**Responsabilità:**
- Richiede autenticazione (utente già registrato)
- Valida token + email match
- Aggiunge utente a `list_members` (atomico)
- Aggiorna invite status = 'accepted'
- Ritorna list_id

**Endpoint:** `POST /functions/v1/accept-invite`
**Body:** `{ token: string }`
**Auth:** Richiesta (Bearer token)
**Response:** `{ success: boolean, listId: string | null }`

## 7. Frontend - Service Layer

### File: `src/lib/invites.ts` (NUOVO)

**Funzioni:**
```typescript
createInvite(email: string, listId: string): Promise<{ success, invite, error }>
validateInvite(token: string): Promise<{ valid, invite, error }>
acceptInvite(token: string): Promise<{ success, listId, error }>
getUserList(): Promise<{ list, error }>
getListMembers(listId: string): Promise<{ members, error }>
```

### File: `src/lib/foods.ts` (MODIFICA)

**Cambiamenti:**
- `createFood()`: Aggiungere logica per recuperare `list_id` dell'utente e includerlo nell'INSERT
- `getFoods()`: Nessun cambiamento (RLS policies gestiscono il filtering automaticamente)
- `updateFood()`, `deleteFood()`: Nessun cambiamento

### File: `src/lib/supabase.ts` (MODIFICA)

**Cambiamenti:**
- Estendere `Database` type con nuove tabelle: `lists`, `list_members`, `invites`
- Definire tipi `List`, `ListMember`, `Invite`

## 8. Frontend - UI Components

### Component: `InviteButton` (NUOVO)
**Path:** `src/components/sharing/InviteButton.tsx`

**Responsabilità:**
- Bottone "Invita membro" con icona UserPlus
- Gestisce stato apertura dialog
- Trigger per `InviteDialog`
- **Feature Flag:** Renderizzato solo se `import.meta.env.VITE_ENABLE_SHARED_LISTS === 'true'`

### Component: `InviteDialog` (NUOVO)
**Path:** `src/components/sharing/InviteDialog.tsx`

**Responsabilità:**
- Dialog modale con form email
- Validazione Zod (email valida)
- Chiamata a `createInvite()` service
- Toast successo/errore
- Reset form dopo submit

### Component: `AppLayout` (MODIFICA)
**Path:** `src/components/layout/AppLayout.tsx`

**Cambiamenti:**
- Aggiungere `<InviteButton />` dentro `DropdownMenuContent`
- Posizione: prima del `DropdownMenuSeparator` che precede logout
- Stile: come `DropdownMenuItem` con `asChild`

### Page: `SignUpPage` (MODIFICA)
**Path:** `src/pages/SignUpPage.tsx`

**Cambiamenti:**
1. Estrarre URL params `invite_token` con `useSearchParams()`
2. `useEffect`: Validare token al mount con `validateInvite()`
3. Mostrare messaggio di benvenuto se invito valido
4. Pre-compilare email se possibile (opzionale)
5. `handleSuccess`: Se token presente, chiamare `acceptInvite(token)` dopo signup
6. Toast conferma "Benvenuto! Ora fai parte della lista condivisa"

### Page: `LoginPage` (MODIFICA OPZIONALE)
**Path:** `src/pages/LoginPage.tsx`

**Cambiamenti:**
- Supportare `invite_token` nell'URL per utenti esistenti
- `handleSuccess`: Se token presente, chiamare `acceptInvite(token)` dopo login

## 9. Flusso Completo Invite

### Scenario: User A invita User B

1. **User A (Dashboard):**
   - Click su avatar → Menu utente
   - Click "Invita membro"
   - Dialog si apre
   - Inserisce `userB@example.com`
   - Submit form

2. **Backend (Edge Function `create-invite`):**
   - Valida che User A sia membro di una lista
   - Genera token random (es. `abc123xyz789...`)
   - Crea record in `invites` table
   - Chiama Supabase Admin API per inviare email

3. **Email (User B riceve):**
   - Subject: "Sei stato invitato su entro!"
   - Body: "User A ti ha invitato a condividere una lista di alimenti."
   - CTA Button: Link a `https://entro-il.netlify.app/signup?invite_token=abc123...`
   - Note: "Il link scade in 7 giorni"

4. **User B (Click su link):**
   - Browser apre SignUpPage con `?invite_token=abc123...`
   - `useEffect` valida token automaticamente
   - Se valido: mostra "Unisciti alla lista di User A"
   - Form signup: email pre-compilata (opzionale)

5. **User B (Signup):**
   - Compila form (email, password, nome)
   - Submit
   - Backend: Crea account Supabase Auth
   - Frontend `handleSuccess`: Chiama `acceptInvite(token)`

6. **Backend (Edge Function `accept-invite`):**
   - Valida token + email match
   - Inserisce User B in `list_members` (atomico)
   - Aggiorna invite status = 'accepted'
   - Ritorna `listId`

7. **User B (Dashboard):**
   - Redirect a `/` (Dashboard)
   - RLS policies: User B ora vede tutti gli alimenti di User A
   - User B può creare/modificare/eliminare alimenti
   - Toast: "Benvenuto! Ora fai parte della lista condivisa."

## 10. Testing Strategy

### Test Manuali

**Test 1: Nuovo Utente (No Invite)**
- [ ] Signup normale → Lista auto-creata
- [ ] User è membro della propria lista
- [ ] Può creare/vedere/modificare alimenti
- [ ] Storage images funzionano

**Test 2: Invite Flow (User A → User B)**
- [ ] User A crea invito → Email ricevuta
- [ ] Validazione token: `validateInvite()` ritorna dati corretti
- [ ] User B signup con token → Account creato
- [ ] `acceptInvite()` aggiunge User B alla lista
- [ ] User B vede alimenti di User A
- [ ] User B può modificare alimenti di User A
- [ ] User B può caricare immagini → User A le vede

**Test 3: Invite Existing User**
- [ ] User C (già registrato) riceve invito
- [ ] Click link → LoginPage con `invite_token`
- [ ] Login → `acceptInvite()` chiamato
- [ ] User C aggiunto alla lista
- [ ] User C vede alimenti condivisi

**Test 4: Multi-Member Collaboration**
- [ ] User A, B, C tutti nella stessa lista
- [ ] Ogni user crea alimenti
- [ ] Tutti vedono tutti gli alimenti
- [ ] Modifiche di un user visibili agli altri
- [ ] Images condivise correttamente

**Test 5: Backward Compatibility**
- [ ] Utente pre-migrazione ha dati intatti
- [ ] Alimenti migrati a `list_id` corretto
- [ ] Può continuare CRUD normalmente
- [ ] RLS policies non bloccano accesso

**Test 6: Edge Cases**
- [ ] Token scaduto → Errore chiaro
- [ ] Email già membro → Errore appropriato
- [ ] Email non match → Errore di validazione
- [ ] Invite multiple volte → Gestito

### Test Database (SQL)
```sql
-- Test RLS: User B vede alimenti di User A?
SET LOCAL "request.jwt.claims" = '{"sub": "<user_b_id>"}';
SELECT * FROM foods WHERE list_id = '<user_a_list_id>';
-- Expected: Ritorna alimenti se User B è membro

-- Test Storage: User B può accedere a immagini di User A?
-- (Testare manualmente via UI upload/view)
```

## 11. Sequenza di Implementazione

### Phase 1: Database Setup (1-2 giorni)
1. ✅ Creare migration file per nuove tabelle (`lists`, `list_members`, `invites`)
2. ✅ Aggiungere `list_id` a tabella `foods`
3. ✅ Creare indici per performance
4. ✅ Implementare RLS policies per nuove tabelle
5. ✅ Aggiornare RLS policies per `foods`
6. ✅ Aggiornare Storage policies
7. ✅ Creare trigger per auto-creazione liste
8. ✅ Eseguire backfill per utenti esistenti
9. ✅ Testare policies con query manuali

### Phase 2: Edge Functions (1 giorno)
1. ✅ Setup Supabase CLI per Edge Functions
2. ✅ Implementare `create-invite` function
3. ✅ Implementare `validate-invite` function
4. ✅ Implementare `accept-invite` function
5. ✅ Deploy functions a Supabase
6. ✅ Testare con Postman/curl

### Phase 3: Service Layer (1 giorno)
1. ✅ Aggiornare `Database` type in `supabase.ts`
2. ✅ Creare `invites.ts` service layer
3. ✅ Modificare `createFood()` in `foods.ts`
4. ✅ Creare `useInvites` hook (opzionale)

### Phase 4: UI Components (1-2 giorni)
1. ✅ Creare `InviteButton.tsx`
2. ✅ Creare `InviteDialog.tsx`
3. ✅ Aggiungere `InviteButton` a `AppLayout`
4. ✅ Testare flow invito nel browser

### Phase 5: Signup Integration (1 giorno)
1. ✅ Modificare `SignUpPage.tsx` per gestire `invite_token`
2. ✅ Implementare validazione token al mount
3. ✅ Implementare `acceptInvite()` in `handleSuccess`
4. ✅ Modificare `LoginPage.tsx` per existing users (opzionale)
5. ✅ Testare end-to-end signup flow

### Phase 6: Testing & Polish (1 giorno)
1. ✅ Testing manuale: tutti gli scenari
2. ✅ Testing multi-device (smartphone + desktop)
3. ✅ Fix eventuali bug
4. ✅ Aggiungere loading states
5. ✅ Aggiungere error handling robusto
6. ✅ Toast messages per UX

### Phase 7: Documentation (0.5 giorni)
1. ✅ Aggiornare `ROADMAP.md`
2. ✅ Aggiornare `USER_GUIDE.md` con sharing feature
3. ✅ Documentare API Edge Functions
4. ✅ Commit finale e deploy

**Stima Totale:** 6-8 giorni di lavoro

## 12. File da Creare/Modificare

### File da CREARE:
- `supabase/migrations/001_create_shared_lists_tables.sql`
- `supabase/migrations/002_add_list_id_to_foods.sql`
- `supabase/migrations/003_update_rls_policies.sql`
- `supabase/migrations/004_update_storage_policies.sql`
- `supabase/migrations/005_backfill_existing_users.sql`
- `supabase/functions/create-invite/index.ts`
- `supabase/functions/validate-invite/index.ts`
- `supabase/functions/accept-invite/index.ts`
- `src/lib/invites.ts`
- `src/types/invite.types.ts`
- `src/components/sharing/InviteButton.tsx`
- `src/components/sharing/InviteDialog.tsx`

### File da MODIFICARE:
- `src/lib/supabase.ts` (Database types)
- `src/lib/foods.ts` (createFood con list_id)
- `src/components/layout/AppLayout.tsx` (add InviteButton)
- `src/pages/SignUpPage.tsx` (invite token handling)
- `src/pages/LoginPage.tsx` (opzionale, existing users)
- `docs/ROADMAP.md` (update progress)
- `docs/USER_GUIDE.md` (document sharing)

## 13. Sicurezza

### Token Security
- ✅ Token generati con `nanoid` (32 caratteri random)
- ✅ Constraint UNIQUE sul token in database
- ✅ Scadenza 7 giorni (configurabile)
- ✅ Single-use (status cambia ad 'accepted')

### RLS Coverage
- ✅ Tutte le tabelle hanno RLS enabled
- ✅ Policies coprono SELECT, INSERT, UPDATE, DELETE
- ✅ Storage policies allineate con database policies
- ✅ Zero data leakage tra liste diverse

### Email Validation
- ✅ Email must match tra invite e signup
- ✅ Token validation prima di accept
- ✅ Expiry check server-side

## 14. Performance

### Indici Critici
- `idx_foods_list_id` - Fast lookup alimenti per lista
- `idx_foods_list_expiry` - Composite per query comuni
- `idx_list_members_user_id` - Fast user → lists
- `idx_list_members_list_id` - Fast list → members

### Query Optimization
- RLS policies usano colonne indicizzate
- EXISTS subqueries ottimizzate da Postgres planner
- Composite indexes coprono pattern più comuni

## 15. Feature Flag Implementation

### Environment Variable
```bash
# .env
VITE_ENABLE_SHARED_LISTS=false  # Disabilitato di default
```

### Frontend Usage
```typescript
// src/components/layout/AppLayout.tsx
const isSharedListsEnabled = import.meta.env.VITE_ENABLE_SHARED_LISTS === 'true'

{isSharedListsEnabled && (
  <DropdownMenuItem asChild>
    <InviteButton />
  </DropdownMenuItem>
)}
```

### Rollback Plan
Se necessario rollback:
1. ✅ Set `VITE_ENABLE_SHARED_LISTS=false` in .env
2. ✅ Redeploy → InviteButton nascosto
3. (Opzionale) Revert RLS policies su `foods` table
4. (Opzionale) Drop nuove tabelle se non usate
5. Dati utenti rimangono intatti (backward compatible)

## 16. Verifica End-to-End

### Dopo Implementazione Completa:
1. [ ] Deploy su staging/production
2. [ ] Creare User A e User B manualmente
3. [ ] User A invita User B via UI
4. [ ] Verificare email ricevuta
5. [ ] User B signup con token
6. [ ] Verificare User B vede alimenti di User A
7. [ ] User B crea nuovo alimento
8. [ ] Verificare User A vede nuovo alimento
9. [ ] User B carica immagine
10. [ ] Verificare User A vede immagine
11. [ ] Testare su mobile (iOS/Android)
12. [ ] Testare offline/online sync
13. [ ] Verificare performance (no lag)
14. [ ] Confermare RLS policies funzionano correttamente

---

## Note Finali

Questo piano implementa un sistema di condivisione semplificato che:
- ✅ È backward compatible (zero breaking changes)
- ✅ Usa approccio household sharing (tutti pari permessi)
- ✅ Ha migrazione automatica per utenti esistenti
- ✅ Mantiene performance ottimali con indici appropriati
- ✅ Ha sicurezza robusta con RLS a livello database
- ✅ Supporta crescita futura (es. multiple liste, ruoli, etc.)
