# Piano: App Native iOS/Android per Entro (React Native + Expo)

## Contesto

Entro è una PWA (React 19, Vite, Tailwind, Supabase) per il tracciamento delle scadenze alimentari, nata come progetto open source e app vetrina/portfolio. L'obiettivo è creare app native iOS e Android con **feature parity completa**, mantenendo la PWA intatta.

**Repo PWA esistente**: `/Users/edmondo/Documents/entro` (GitHub: `E-Lop/entro`)
**Supabase project ref**: `rmbmmwcxtnanacxbkihc`
**Dominio PWA**: `entroapp.it` (hosting Netlify)

**Approccio di sviluppo**: Spec-driven + Test-driven (TDD)
- Ogni fase inizia con la scrittura di spec markdown (`docs/specs/`)
- I test vengono scritti PRIMA del codice di implementazione
- Il codice viene scritto per far passare i test

---

## Dove si lavora

| Fase | Repo | Note |
|---|---|---|
| Fase 0-6, 8-10 | **Nuova repo `entro-mobile`** | Tutto lo sviluppo dell'app nativa |
| Fase 7 (push notifications backend) | **Repo `entro` esistente** | Solo modifiche additive e retrocompatibili a edge functions e DB |

---

## Struttura Nuova Repo: `entro-mobile`

```
entro-mobile/
├── app.json                    (configurazione Expo)
├── eas.json                    (configurazione EAS Build)
├── app/                        (Expo Router - file-based routing)
│   ├── _layout.tsx             (root: providers, auth check)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   └── verify-email.tsx
│   └── (app)/
│       ├── _layout.tsx         (tab navigator + auth guard)
│       ├── index.tsx           (dashboard)
│       ├── calendar.tsx
│       ├── settings.tsx
│       └── guide.tsx
├── src/
│   ├── shared/                 (copiato dalla PWA, adattato)
│   │   ├── types/
│   │   │   ├── food.types.ts       ← da entro/src/types/food.types.ts
│   │   │   ├── invite.types.ts     ← da entro/src/types/invite.types.ts
│   │   │   ├── auth.types.ts       ← da entro/src/types/auth.types.ts
│   │   │   └── openfoodfacts.types.ts ← da entro/src/types/openfoodfacts.types.ts
│   │   ├── validations/
│   │   │   ├── food.schemas.ts     ← da entro/src/lib/validations/food.schemas.ts
│   │   │   └── auth.schemas.ts     ← da entro/src/lib/validations/auth.schemas.ts
│   │   ├── supabase.types.ts       ← tipo Database da entro/src/lib/supabase.ts (righe 50-161)
│   │   └── lib/
│   │       ├── foods.ts            ← da entro/src/lib/foods.ts
│   │       ├── invites.ts          ← da entro/src/lib/invites.ts
│   │       └── openfoodfacts.ts    ← da entro/src/lib/openfoodfacts.ts
│   ├── lib/                    (platform-specific per React Native)
│   │   ├── supabase.ts         (client con AsyncStorage)
│   │   ├── auth.ts             (adattato: AsyncStorage/SecureStore al posto di localStorage)
│   │   ├── pushNotifications.ts (expo-notifications, riscrittura completa)
│   │   ├── haptics.ts          (expo-haptics, riscrittura completa)
│   │   ├── storage.ts          (expo-image-manipulator per compressione)
│   │   ├── queryPersister.ts   (AsyncStorage persister)
│   │   ├── realtime.ts         (adattato: AppState al posto di document.hidden)
│   │   ├── dataExport.ts       (expo-file-system + expo-sharing)
│   │   └── pendingImages.ts    (expo-file-system al posto di idb-keyval)
│   ├── hooks/
│   │   ├── useAuth.ts          (adattato: toast RN)
│   │   ├── useFoods.ts         (adattato: toast RN)
│   │   ├── useRealtimeFoods.ts (adattato: AppState)
│   │   ├── usePushSubscription.ts (riscrittura: expo-notifications)
│   │   ├── useOnlineStatus.ts  (riscrittura: NetInfo)
│   │   ├── useBarcodeScanner.ts (riscrittura: expo-camera)
│   │   ├── useTheme.ts         (riscrittura: useColorScheme + AsyncStorage)
│   │   ├── useNotificationPreferences.ts (adattato: toast RN)
│   │   ├── useSignedUrl.ts     (portabile as-is)
│   │   └── useDebounce.ts      (portabile as-is)
│   ├── components/             (React Native UI, da creare ex novo)
│   │   ├── ui/                 (Button, Card, Input, Dialog, ecc.)
│   │   ├── foods/              (FoodCard, FoodForm, FoodList, FoodFilters)
│   │   ├── auth/               (LoginForm, SignUpForm)
│   │   ├── calendar/           (WeekView, DayColumn)
│   │   ├── settings/           (NotificationSettings, DeleteAccount, DataExport)
│   │   ├── sharing/            (InviteDialog, AcceptInvite)
│   │   └── common/             (OfflineBanner, LoadingSpinner, EmptyState)
│   └── stores/
│       └── authStore.ts        (adattato: AsyncStorage + router.replace)
├── package.json
├── tsconfig.json
├── tailwind.config.js          (per NativeWind)
└── .env                        (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)
```

---

## Scelte Tecnologiche

| Area | Libreria | Sostituisce (web) | Motivazione |
|---|---|---|---|
| Navigation | **Expo Router v4** | React Router DOM | File-based routing, deep linking built-in |
| Styling | **NativeWind v4** | Tailwind CSS | Stessa sintassi utility-class della PWA |
| UI Components | **Custom con NativeWind** | shadcn/ui (Radix) | shadcn è web-only, si creano equivalenti RN |
| Push Notifications | **expo-notifications** | Web Push API | Gestisce APNs + FCM automaticamente |
| Barcode Scanner | **expo-camera** (scanBarcodes) | @zxing/browser | Scanner nativo, molto più performante |
| Haptic Feedback | **expo-haptics** | web-haptics | API nativa per vibrazioni |
| Auth Storage | **expo-secure-store** | localStorage/sessionStorage | Crittografato su device |
| Data Storage | **@react-native-async-storage/async-storage** | localStorage | Storage asincrono per preferenze |
| Query Persistence | **@tanstack/query-async-storage-persister** | idb-keyval (IndexedDB) | Stesso pattern, diverso backend |
| Images | **expo-image** + **expo-image-manipulator** | browser-image-compression | Caching nativo + compressione nativa |
| Image Picker | **expo-image-picker** | `<input type="file">` | Camera + galleria nativi |
| Gestures | **react-native-reanimated** + **gesture-handler** | react-swipeable | Swipe-to-dismiss performante |
| Toast | **burnt** | sonner | Toast nativi iOS/Android |
| Data Export | **expo-file-system** + **expo-sharing** | Blob + download | Share sheet nativo |
| Network Status | **@react-native-community/netinfo** | navigator.onLine | Monitoring rete nativo |
| Forms | **react-hook-form** + **zod** (invariato) | — | Funziona identico su RN |
| State | **zustand** (invariato) | — | Funziona identico su RN |
| Date | **date-fns** (invariato) | — | Funziona identico su RN |
| Supabase | **@supabase/supabase-js** (invariato) | — | Supporta RN con adapter AsyncStorage |
| **Testing** | **Jest** + **@testing-library/react-native** | vitest | Viene con Expo, testing library identica alla web |
| **E2E Testing** | **Maestro** | — | E2E su simulator/device, YAML-based, semplice |

---

## Approccio Spec-Driven + TDD

### Struttura documenti

```
entro-mobile/
├── docs/
│   └── specs/
│       ├── 00-architecture.md      (overview architettura, tech stack, convenzioni)
│       ├── 01-auth.md              (flussi auth, schermate, stati, edge cases)
│       ├── 02-dashboard.md         (lista alimenti, filtri, statistiche, UI)
│       ├── 03-food-crud.md         (form, validazione, immagini, mutations)
│       ├── 04-barcode.md           (scanner, Open Food Facts, permessi camera)
│       ├── 05-calendar.md          (vista settimanale, navigazione, layout)
│       ├── 06-sharing.md           (inviti, deep linking, realtime, liste condivise)
│       ├── 07-push-notifications.md (registrazione token, backend, preferenze)
│       ├── 08-offline.md           (persistence, mutation queue, sync, pending images)
│       ├── 09-settings.md          (account, export, haptics, dark mode, guide)
│       └── 10-deployment.md        (EAS build, store submission, metadata)
├── __tests__/                      (test organizzati per feature)
│   ├── shared/                     (test per codice condiviso)
│   │   ├── foods.test.ts
│   │   ├── invites.test.ts
│   │   ├── openfoodfacts.test.ts
│   │   └── validations.test.ts
│   ├── lib/                        (test per adapter platform-specific)
│   │   ├── auth.test.ts
│   │   ├── supabase.test.ts
│   │   ├── storage.test.ts
│   │   ├── pushNotifications.test.ts
│   │   └── queryPersister.test.ts
│   ├── hooks/                      (test per hooks)
│   │   ├── useAuth.test.ts
│   │   ├── useFoods.test.ts
│   │   ├── useRealtimeFoods.test.ts
│   │   └── useOnlineStatus.test.ts
│   ├── components/                 (test per componenti UI)
│   │   ├── FoodCard.test.tsx
│   │   ├── FoodForm.test.tsx
│   │   ├── LoginForm.test.tsx
│   │   └── Dashboard.test.tsx
│   └── __mocks__/                  (mock condivisi)
│       ├── supabase.ts             (mock Supabase client)
│       ├── asyncStorage.ts         (mock AsyncStorage)
│       └── expoModules.ts          (mock expo-camera, expo-haptics, ecc.)
├── maestro/                        (test E2E con Maestro)
│   ├── flows/
│   │   ├── auth-login.yaml
│   │   ├── auth-signup.yaml
│   │   ├── food-crud.yaml
│   │   ├── barcode-scan.yaml
│   │   └── offline-sync.yaml
│   └── .maestro/                   (config Maestro)
```

### Workflow per ogni fase

Ogni fase segue questo ciclo:

1. **Spec** → Scrivere il documento markdown in `docs/specs/XX-feature.md`
   - Requisiti funzionali e non-funzionali
   - Flussi utente (happy path + edge cases)
   - Mapping componenti/schermate
   - API contracts (Supabase queries, edge functions)
   - Acceptance criteria (checklist verificabile)

2. **Test** → Scrivere i test in `__tests__/`
   - Unit test per business logic (lib, shared)
   - Integration test per hooks (React Query + mock Supabase)
   - Component test per UI (rendering, interazioni)
   - I test DEVONO fallire inizialmente (red phase)

3. **Implement** → Scrivere il codice per far passare i test (green phase)

4. **Refactor** → Semplificare il codice mantenendo i test verdi

5. **E2E** → Scrivere flow Maestro per i percorsi critici

### Setup testing

```bash
# Jest + React Native Testing Library (già incluso con Expo)
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo

# Mock per Supabase
npm install --save-dev @supabase/supabase-js  # (già in deps, mock manuale)

# Maestro per E2E (installazione globale)
# curl -Ls "https://get.maestro.mobile.dev" | bash
```

In `package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "maestro test maestro/flows/"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterSetup": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|burnt)"
    ]
  }
}
```

### Esempio spec: `docs/specs/01-auth.md`

```markdown
# Spec: Autenticazione

## Overview
Gestione completa dell'autenticazione utente tramite Supabase Auth.

## Flussi

### Login
1. Utente inserisce email + password
2. Validazione client-side (Zod: email valida, password ≥6 char)
3. Chiamata `supabase.auth.signInWithPassword()`
4. Successo → redirect a Dashboard
5. Errore → mostrare messaggio (credenziali errate, email non verificata)

### Signup
1. Utente inserisce nome completo, email, password, conferma password
2. Validazione Zod (password match, requisiti sicurezza)
3. Chiamata signup → email verifica inviata
4. Redirect a VerifyEmail page

### Edge Cases
- Network error durante login → toast errore + retry
- Session expired → redirect a login
- Deep link da password reset → auto-login

## Acceptance Criteria
- [ ] Login con credenziali valide → dashboard
- [ ] Login con credenziali errate → messaggio errore
- [ ] Signup → email verifica inviata
- [ ] Logout → torna a login, dati cancellati
- [ ] Session persistence → riapertura app = già loggato
```

---

## Analisi Riuso Codice (file sorgente PWA)

### Copiare AS-IS in `src/shared/` (adattamenti minimi)

| File PWA | Destinazione mobile | Adattamento |
|---|---|---|
| `src/types/food.types.ts` | `src/shared/types/food.types.ts` | Sostituire `File` con tipo generico per immagine |
| `src/types/invite.types.ts` | `src/shared/types/invite.types.ts` | Nessuno |
| `src/types/auth.types.ts` | `src/shared/types/auth.types.ts` | Nessuno |
| `src/types/openfoodfacts.types.ts` | `src/shared/types/openfoodfacts.types.ts` | Nessuno |
| `src/lib/validations/auth.schemas.ts` | `src/shared/validations/auth.schemas.ts` | Nessuno |
| `src/lib/validations/food.schemas.ts` | `src/shared/validations/food.schemas.ts` | Sostituire `z.instanceof(File)` con tipo platform-agnostic |
| `src/lib/supabase.ts` righe 50-161 | `src/shared/supabase.types.ts` | Solo il tipo `Database`, non il client |
| `src/lib/foods.ts` | `src/shared/lib/foods.ts` | Cambiare import di `supabase` per usare istanza iniettata |
| `src/lib/invites.ts` | `src/shared/lib/invites.ts` | Sostituire `import.meta.env` con `process.env.EXPO_PUBLIC_*` |
| `src/lib/openfoodfacts.ts` | `src/shared/lib/openfoodfacts.ts` | Nessuno (usa solo `fetch`) |

### Adattare per React Native (logica riutilizzabile, API platform-specific)

| File PWA | File mobile | Cosa cambia |
|---|---|---|
| `src/lib/auth.ts` | `src/lib/auth.ts` | `localStorage` → `AsyncStorage`, `sessionStorage` → `SecureStore`, `window.location.origin` → URL costante per redirect |
| `src/lib/storage.ts` | `src/lib/storage.ts` | `browser-image-compression` → `expo-image-manipulator`, `File` API → `expo-image-picker` result |
| `src/lib/realtime.ts` | `src/lib/realtime.ts` | Toast `sonner` → `burnt`, logica core identica |
| `src/lib/queryPersister.ts` | `src/lib/queryPersister.ts` | `idb-keyval` → `@tanstack/query-async-storage-persister` |
| `src/lib/dataExport.ts` | `src/lib/dataExport.ts` | `Blob`/`URL.createObjectURL` → `expo-file-system` + `expo-sharing` |
| `src/lib/pendingImages.ts` | `src/lib/pendingImages.ts` | `idb-keyval` → `expo-file-system` per storage locale immagini |
| `src/stores/authStore.ts` | `src/stores/authStore.ts` | `sessionStorage`/`localStorage` → `AsyncStorage`, `window.location.reload()` → `router.replace()`, rimuovere `window.location.hash` checks |
| `src/hooks/useFoods.ts` | `src/hooks/useFoods.ts` | Solo toast `sonner` → `burnt` |
| `src/hooks/useRealtimeFoods.ts` | `src/hooks/useRealtimeFoods.ts` | `document.hidden`/`visibilitychange` → `AppState` di RN |
| `src/hooks/useAuth.ts` | `src/hooks/useAuth.ts` | Solo toast |
| `src/hooks/useNotificationPreferences.ts` | `src/hooks/useNotificationPreferences.ts` | Solo toast |
| `src/hooks/useSignedUrl.ts` | `src/hooks/useSignedUrl.ts` | Portabile as-is |
| `src/hooks/useDebounce.ts` | `src/hooks/useDebounce.ts` | Portabile as-is |
| `src/hooks/useTheme.ts` | `src/hooks/useTheme.ts` | `localStorage` + `document.documentElement` → `useColorScheme` + `AsyncStorage` |

### Riscrivere completamente (web-only → native-only)

| File PWA (riferimento) | File mobile | Motivo |
|---|---|---|
| `src/lib/pushNotifications.ts` | `src/lib/pushNotifications.ts` | Web Push API → expo-notifications |
| `src/lib/haptics.ts` | `src/lib/haptics.ts` | web-haptics → expo-haptics |
| `src/hooks/useBarcodeScanner.ts` | `src/hooks/useBarcodeScanner.ts` | @zxing/browser → expo-camera |
| `src/hooks/useOnlineStatus.ts` | `src/hooks/useOnlineStatus.ts` | navigator.onLine → NetInfo |
| Tutti `src/components/**` | `src/components/**` | JSX web → React Native components |
| Tutti `src/pages/**` | `app/**` | React Router pages → Expo Router screens |

---

## Fasi di Implementazione

### Fase 0: Setup Repo + Progetto Expo + Infrastruttura Test
**Repo: `entro-mobile` (nuova)**

- [ ] Creare repo `entro-mobile` su GitHub
- [ ] Creare progetto Expo:
  ```bash
  npx create-expo-app@latest entro-mobile --template blank-typescript
  cd entro-mobile
  ```
- [ ] Installare Expo Router:
  ```bash
  npx expo install expo-router expo-linking expo-constants expo-status-bar
  ```
- [ ] Installare NativeWind:
  ```bash
  npx expo install nativewind tailwindcss
  # Configurare tailwind.config.js e babel.config.js per NativeWind v4
  ```
- [ ] Installare dipendenze core:
  ```bash
  npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store
  npm install zustand @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
  npm install react-hook-form @hookform/resolvers zod date-fns burnt
  ```
- [ ] Copiare dalla PWA (`/Users/edmondo/Documents/entro/`) in `src/shared/`:
  - `src/types/` → `src/shared/types/`
  - `src/lib/validations/` → `src/shared/validations/`
  - `src/lib/foods.ts`, `invites.ts`, `openfoodfacts.ts` → `src/shared/lib/`
  - Tipo `Database` da `src/lib/supabase.ts:50-161` → `src/shared/supabase.types.ts`
- [ ] Adattare file copiati:
  - `import.meta.env.VITE_*` → `process.env.EXPO_PUBLIC_*`
  - `z.instanceof(File)` → tipo generico `z.any()` o `z.string()` per URI
  - Import `supabase` client → parametro iniettato o import dal file locale
- [ ] Creare `.env`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://rmbmmwcxtnanacxbkihc.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<stessa anon key della PWA, da .env.local>
  ```
- [ ] Installare infrastruttura test:
  ```bash
  npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo
  ```
- [ ] Configurare Jest in `package.json` (vedi sezione "Setup testing" sopra)
- [ ] Creare `__tests__/__mocks__/supabase.ts` (mock del client Supabase)
- [ ] Creare `__tests__/__mocks__/asyncStorage.ts` (mock AsyncStorage)
- [ ] Creare `__tests__/__mocks__/expoModules.ts` (mock moduli Expo)
- [ ] Creare `docs/specs/00-architecture.md` — documento architettura generale
- [ ] Verificare `npm test` funziona (anche con 0 test)

### Fase 1: Autenticazione
**Repo: `entro-mobile`**

**1a. Spec:** Scrivere `docs/specs/01-auth.md`
- Flussi: login, signup, forgot password, verify email, logout, session persistence
- Edge cases: network error, email non verificata, session expired, deep link password reset
- Acceptance criteria con checklist

**1b. Test (red):** Scrivere test PRIMA del codice
- `__tests__/lib/auth.test.ts` — signIn, signUp, signOut, resetPassword (mock Supabase)
- `__tests__/lib/supabase.test.ts` — client creato con AsyncStorage adapter
- `__tests__/hooks/useAuth.test.ts` — hook auth state transitions
- `__tests__/components/LoginForm.test.tsx` — rendering, validazione, submit

**1c. Implement (green):**
- [ ] Creare `src/lib/supabase.ts`:
  ```typescript
  import AsyncStorage from '@react-native-async-storage/async-storage'
  import { createClient } from '@supabase/supabase-js'
  import { Database } from '../shared/supabase.types'

  export const supabase = createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Non serve su mobile
      },
      realtime: {
        params: { eventsPerSecond: 10 },
        heartbeatIntervalMs: 15000,
        timeout: 20000,
      },
    }
  )
  ```
- [ ] Portare e adattare `src/stores/authStore.ts` dalla PWA
  - Riferimento: `entro/src/stores/authStore.ts`
  - Sostituire `sessionStorage` → `AsyncStorage`
  - Sostituire `window.location.reload()` → `router.replace('/')`
  - Rimuovere check su `window.location.hash` (non esiste su mobile)
- [ ] Portare e adattare `src/lib/auth.ts`
  - Riferimento: `entro/src/lib/auth.ts`
  - `localStorage.removeItem()` → `AsyncStorage.removeItem()`
  - `window.location.origin` → URL costante per redirect password reset
- [ ] Implementare schermate auth:
  - `app/(auth)/login.tsx` — basato su `entro/src/pages/LoginPage.tsx`
  - `app/(auth)/signup.tsx` — basato su `entro/src/pages/SignUpPage.tsx`
  - `app/(auth)/forgot-password.tsx` — basato su `entro/src/pages/ForgotPasswordPage.tsx`
  - `app/(auth)/verify-email.tsx` — basato su `entro/src/pages/VerifyEmailPage.tsx`
- [ ] Configurare routing Expo Router con auth guard in `app/_layout.tsx`
- [ ] Creare componenti UI base necessari per auth: Button, Input, Label, Form

**1d. Verify:** `npm test` — tutti i test auth devono passare

**1e. E2E:** `maestro/flows/auth-login.yaml`, `auth-signup.yaml`

### Fase 2: UI Components + Dashboard
**Repo: `entro-mobile`**

**2a. Spec:** Scrivere `docs/specs/02-dashboard.md`
- Layout dashboard, filtri, statistiche, lista alimenti, stato vuoto
- Swipe gestures su FoodCard (swipe left = delete, swipe right = consume)
- Pull-to-refresh, infinite scroll

**2b. Test (red):**
- `__tests__/components/FoodCard.test.tsx` — rendering, colori scadenza, swipe
- `__tests__/components/Dashboard.test.tsx` — lista, filtri, empty state
- `__tests__/hooks/useFoods.test.ts` — query, filtri, sorting

**2c. Implement (green):**
- [ ] Creare libreria componenti UI con NativeWind (equivalenti shadcn/ui):
  - Button, Card, Input, TextArea, Label
  - Dialog/Modal (con react-native `Modal`)
  - AlertDialog
  - DropdownMenu (con ActionSheet nativo)
  - Toast (con `burnt`)
- [ ] Implementare `FoodCard` con swipe gestures
  - Riferimento design: `entro/src/components/foods/FoodCard.tsx`
  - Usare `react-native-gesture-handler` + `react-native-reanimated` per swipe
  - Installare: `npx expo install react-native-gesture-handler react-native-reanimated`
- [ ] Implementare Dashboard (`app/(app)/index.tsx`)
  - Riferimento: `entro/src/pages/DashboardPage.tsx`
  - FoodList con `FlatList` + pull-to-refresh
  - FoodFilters (status, storage, search)
  - DashboardStats (contatori scadenze)
  - EmptyState
- [ ] Collegare `useFoods` hook adattato

**2d. Verify:** `npm test` — tutti i test dashboard devono passare

**2e. E2E:** `maestro/flows/dashboard-browse.yaml`

### Fase 3: Food CRUD + Immagini
**Repo: `entro-mobile`**

**3a. Spec:** Scrivere `docs/specs/03-food-crud.md`
- Form fields, validazione Zod, categorie, storage location
- Image picker (camera/galleria), compressione, upload Supabase Storage
- Mutations: create, update, delete (soft), cambio stato (consumed/expired/wasted)
- Optimistic updates e rollback

**3b. Test (red):**
- `__tests__/shared/foods.test.ts` — CRUD functions (mock Supabase)
- `__tests__/shared/validations.test.ts` — Zod schemas
- `__tests__/lib/storage.test.ts` — compressione, upload (mock expo-image-manipulator)
- `__tests__/components/FoodForm.test.tsx` — rendering, validazione, submit

**3c. Implement (green):**
- [ ] Installare: `npx expo install expo-image expo-image-picker expo-image-manipulator`
- [ ] Implementare `FoodForm` con react-hook-form + Zod
  - Riferimento: `entro/src/components/foods/FoodFormDialog.tsx`
  - Usare `expo-image-picker` per camera/galleria
  - Usare `expo-image-manipulator` per compressione (max 1MB)
- [ ] Creare `src/lib/storage.ts` per upload immagini
  - Riferimento: `entro/src/lib/storage.ts`
  - Stessa logica Supabase Storage, diversa compressione
- [ ] Implementare mutations (create, update, delete, cambio stato)
  - Riferimento: `entro/src/hooks/useFoods.ts`
- [ ] Dialog di conferma per delete e cambio stato
- [ ] Visualizzazione immagini con `expo-image` + signed URL

**3d. Verify:** `npm test`

**3e. E2E:** `maestro/flows/food-crud.yaml` (create, edit, delete, status change)

### Fase 4: Barcode Scanner
**Repo: `entro-mobile`**

**4a. Spec:** Scrivere `docs/specs/04-barcode.md`
- Flusso scan, permessi camera, formati barcode supportati
- Integrazione Open Food Facts API, campi auto-fill
- Fallback se prodotto non trovato

**4b. Test (red):**
- `__tests__/shared/openfoodfacts.test.ts` — lookup barcode, parsing response, prodotto non trovato
- `__tests__/hooks/useBarcodeScanner.test.ts` — stato scanner, permission handling (mock expo-camera)

**4c. Implement (green):**
- [ ] Installare: `npx expo install expo-camera`
- [ ] Creare schermata/modal scanner barcode
  - Riferimento logica: `entro/src/hooks/useBarcodeScanner.ts`
  - Usare `CameraView` di expo-camera con `barcodeScannerSettings`
- [ ] Collegare a `openfoodfacts.ts` (già in `src/shared/lib/`)
- [ ] Flusso: scan → lookup → pre-fill FoodForm
- [ ] Gestione permessi camera con UX appropriata

**4d. Verify:** `npm test`

**4e. E2E:** `maestro/flows/barcode-scan.yaml` (richiede device fisico con camera)

### Fase 5: Vista Calendario
**Repo: `entro-mobile`**

**5a. Spec:** Scrivere `docs/specs/05-calendar.md`
- Vista 7 giorni, navigazione swipe, layout colonne
- Raggruppamento alimenti per data scadenza
- Indicatori visivi (colori scadenza)

**5b. Test (red):**
- `__tests__/components/WeekView.test.tsx` — rendering giorni, navigazione
- `__tests__/components/CalendarFoodCard.test.tsx` — rendering, colori

**5c. Implement (green):**
- [ ] Implementare CalendarView
  - Riferimento: `entro/src/components/calendar/WeekView.tsx`, `DayColumn.tsx`
  - WeekView con swipe orizzontale (`ScrollView` horizontal + `react-native-reanimated`)
  - DayColumn con lista alimenti per giorno
  - CalendarFoodCard

**5d. Verify:** `npm test`

### Fase 6: Liste Condivise + Inviti + Realtime
**Repo: `entro-mobile`**

**6a. Spec:** Scrivere `docs/specs/06-sharing.md`
- Creazione invito (6 char code), condivisione via share sheet
- Accettazione invito da deep link, flussi per utente nuovo/esistente
- Realtime subscription, deduplicazione eventi
- Edge cases: invito scaduto, lista piena, utente già membro

**6b. Test (red):**
- `__tests__/shared/invites.test.ts` — create, accept, validate invite (mock Supabase)
- `__tests__/lib/realtime.test.ts` — event handling, deduplication
- `__tests__/hooks/useRealtimeFoods.test.ts` — subscription, AppState handling

**6c. Implement (green):**
- [ ] Installare: `npx expo install expo-linking`
- [ ] Implementare creazione invito
  - Riferimento: `entro/src/components/sharing/InviteDialog.tsx`
  - Usare `Share` API nativa di RN per condividere il codice
- [ ] Configurare deep linking in `app.json`:
  ```json
  { "expo": { "scheme": "entro" } }
  ```
- [ ] Implementare accettazione invito da deep link `entro://join/CODE`
  - Riferimento: `entro/src/pages/JoinPage.tsx`
- [ ] Portare e adattare `src/lib/realtime.ts`
  - Riferimento: `entro/src/lib/realtime.ts`
- [ ] Portare e adattare `useRealtimeFoods.ts`
  - `document.hidden` → `AppState.currentState`
  - `document.addEventListener('visibilitychange')` → `AppState.addEventListener('change')`
- [ ] Configurare universal links (per URL `entroapp.it/join/CODE` che apre l'app):
  - Hostare `.well-known/apple-app-site-association` su `entroapp.it`
  - Hostare `.well-known/assetlinks.json` su `entroapp.it`
  - (Richiede Apple Developer Account — si può fare dopo Fase 10)

**6d. Verify:** `npm test`

**6e. E2E:** `maestro/flows/invite-create.yaml`, `maestro/flows/invite-accept.yaml`

### Fase 7: Push Notifications
**Repo: ENTRAMBE**

**7a-spec. Spec:** Scrivere `docs/specs/07-push-notifications.md`
- Registrazione token Expo, salvataggio su Supabase
- Modifica backend: supporto platform web/ios/android
- Preferenze notifiche, quiet hours
- Flusso: cron → query cibi in scadenza → invio notifica → tap → navigazione

**7a-test. Test (red):**
- `__tests__/lib/pushNotifications.test.ts` — registrazione token, unsubscribe (mock expo-notifications)
- `__tests__/hooks/usePushSubscription.test.ts` — stato permission, token

**7a-impl. Mobile (`entro-mobile`):**
- [ ] Installare: `npx expo install expo-notifications expo-device expo-constants`
- [ ] Creare `src/lib/pushNotifications.ts` (riscrittura completa)
  - Registrare per push token (Expo push token)
  - Salvare token su Supabase via edge function `register-push`
  - Passare `platform: 'ios'` o `platform: 'android'`
- [ ] Implementare `usePushSubscription.ts`
- [ ] Schermata preferenze notifiche
  - Riferimento: `entro/src/components/settings/NotificationSettings.tsx`
- [ ] Handler tap su notifica → navigazione alla schermata rilevante

**7b. Backend (`entro` repo esistente — `/Users/edmondo/Documents/entro`):**

> ⚠️ TUTTE LE MODIFICHE SONO ADDITIVE E RETROCOMPATIBILI. La PWA continua a funzionare identicamente.

- [ ] **Migration DB**: aggiungere colonne a `push_subscriptions`:
  ```sql
  ALTER TABLE push_subscriptions
    ADD COLUMN platform text NOT NULL DEFAULT 'web'
      CHECK (platform IN ('web', 'ios', 'android')),
    ADD COLUMN expo_token text;
  -- Le subscription esistenti diventano automaticamente platform='web'
  ```
- [ ] **`register-push` edge function** (`supabase/functions/register-push/index.ts`):
  - Aggiungere campo opzionale `platform` e `expoToken` all'interfaccia `SubscribeRequest`
  - Se `platform` è `ios`/`android`: salvare `expo_token` invece di `endpoint`/`p256dh`/`auth_key`
  - Se `platform` non è passato (PWA): comportamento invariato
- [ ] **`send-expiry-notifications` edge function** (`supabase/functions/send-expiry-notifications/index.ts`):
  - Dopo aver recuperato le subscription, dividere per `platform`
  - `platform='web'` → inviare via `@negrel/webpush` (come oggi)
  - `platform='ios'|'android'` → inviare via Expo Push API:
    ```typescript
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: subscription.expo_token,
        title: 'Alimento in scadenza',
        body: `${foodName} scade ${expiryText}`,
        data: { foodId: food.id },
      }),
    })
    ```

**7c. Verify:** `npm test`

### Fase 8: Offline Support
**Repo: `entro-mobile`**

**8a. Spec:** Scrivere `docs/specs/08-offline.md`
- Persistence React Query, mutation queue, resume on reconnect
- Pending images: salvataggio locale, upload al ritorno online
- Network status detection, offline banner
- Edge cases: conflict resolution, mutation failure, stale cache

**8b. Test (red):**
- `__tests__/lib/queryPersister.test.ts` — serializzazione/deserializzazione cache
- `__tests__/hooks/useOnlineStatus.test.ts` — stato online/offline (mock NetInfo)
- `__tests__/lib/pendingImages.test.ts` — save/load/cleanup pending images

**8c. Implement (green):**
- [ ] Installare: `npx expo install @react-native-community/netinfo`
- [ ] Creare `src/lib/queryPersister.ts`
  - Usare `createAsyncStoragePersister` da `@tanstack/query-async-storage-persister`
  - Riferimento pattern: `entro/src/lib/queryPersister.ts`
- [ ] Configurare React Query con persistence in `app/_layout.tsx`
  - `PersistQueryClientProvider` wrappa l'app
  - `onlineManager.setEventListener` con NetInfo
- [ ] Portare `src/lib/mutationDefaults.ts`
  - Riferimento: `entro/src/lib/mutationDefaults.ts`
  - Stessa logica di pausa/ripresa mutations
- [ ] Creare `src/hooks/useOnlineStatus.ts` con NetInfo
- [ ] Implementare OfflineBanner component
- [ ] Creare `src/lib/pendingImages.ts` con `expo-file-system`
  - Riferimento: `entro/src/lib/pendingImages.ts`
  - Stessa logica `pending://` protocol, storage su filesystem locale

**8d. Verify:** `npm test`

**8e. E2E:** `maestro/flows/offline-sync.yaml`

### Fase 9: Settings, Export, Polish
**Repo: `entro-mobile`**

**9a. Spec:** Scrivere `docs/specs/09-settings.md`
- Account info, cambio password, eliminazione account
- Preferenze notifiche, toggle haptic, tema chiaro/scuro
- Data export JSON, guida in-app

**9b. Test (red):**
- `__tests__/lib/dataExport.test.ts` — generazione JSON, sharing (mock expo-file-system)
- `__tests__/lib/haptics.test.ts` — mapping haptic types (mock expo-haptics)
- `__tests__/hooks/useTheme.test.ts` — toggle, persistence

**9c. Implement (green):**
- [ ] Implementare schermata Settings
  - Riferimento: `entro/src/pages/SettingsPage.tsx`
  - Account info, preferenze notifiche, haptic toggle, tema, export, elimina account
- [ ] Data export:
  ```typescript
  import * as FileSystem from 'expo-file-system'
  import * as Sharing from 'expo-sharing'
  // Scrivere JSON su file temp, poi condividere via share sheet
  ```
  - Riferimento logica: `entro/src/lib/dataExport.ts`
- [ ] Haptic feedback con `expo-haptics`:
  ```typescript
  import * as Haptics from 'expo-haptics'
  // Mapping da web-haptics:
  // triggerHaptic('success') → Haptics.notificationAsync(NotificationFeedbackType.Success)
  // triggerHaptic('light') → Haptics.impactAsync(ImpactFeedbackStyle.Light)
  ```
  - Riferimento: `entro/src/lib/haptics.ts` per i punti di integrazione
- [ ] Dark mode: `useColorScheme` di RN + classi NativeWind `dark:`
- [ ] Guida/help in-app
  - Riferimento: `entro/src/components/guide/`
- [ ] App icon e splash screen in `app.json`

**9d. Verify:** `npm test` — coverage target ≥80%

### Fase 10: Testing Finale + Pubblicazione
**Repo: `entro-mobile`**

**10a. Spec:** Scrivere `docs/specs/10-deployment.md`
- Configurazione EAS Build, code signing
- Metadata App Store e Google Play
- Privacy policy, screenshots, descrizione

**10b. Test finali:**
- [ ] `npm test` — tutti i test passano, coverage ≥80%
- [ ] `maestro test maestro/flows/` — tutti i flussi E2E passano
- [ ] Test E2E su dispositivi fisici (o Expo Go per test rapidi)
- [ ] Creare account:
  - **Apple Developer Program**: https://developer.apple.com/programs/ (99€/anno)
  - **Google Play Console**: https://play.google.com/console (25$ una tantum)
- [ ] Installare EAS CLI: `npm install -g eas-cli`
- [ ] Login: `eas login`
- [ ] Configurare build in `eas.json`:
  ```json
  {
    "build": {
      "development": { "developmentClient": true, "distribution": "internal" },
      "preview": { "distribution": "internal" },
      "production": {}
    },
    "submit": {
      "production": {
        "ios": { "appleId": "...", "ascAppId": "...", "appleTeamId": "..." },
        "android": { "serviceAccountKeyPath": "./google-service-account.json" }
      }
    }
  }
  ```
- [ ] Build: `eas build --platform all`
- [ ] Submit: `eas submit --platform all`
  - ⚠️ Prima submission Android deve essere manuale (requisito Google)
- [ ] Preparare metadata per entrambi gli store:
  - Screenshots iPhone e Android
  - Descrizione, parole chiave
  - Privacy policy URL (può puntare a `entroapp.it/privacy`)
  - Categoria: Food & Drink
- [ ] Submit per review

---

## Rischi e Mitigazioni

| Rischio | Mitigazione |
|---|---|
| Non tutte le classi Tailwind funzionano in NativeWind | Testare compatibilità in Fase 2, creare mapping per classi non supportate |
| Push notification backend split (web + native) | Expo Push API come gateway unificato; subscription separate per platform |
| Deep linking richiede Apple Developer Account | Funziona con `entro://` scheme subito; universal links configurabili dopo |
| Compressione immagini diversa tra piattaforme | Testare output e calibrare parametri expo-image-manipulator |
| Supabase realtime su mobile (background/foreground) | `AppState` listener per riconnessione; stessa logica della PWA adattata |

---

## Modifiche Backend Necessarie

> **Garanzia: tutte le modifiche sono additive e retrocompatibili.** La PWA continua a funzionare esattamente come prima — non viene modificato né rimosso nulla di esistente.

1. **`push_subscriptions` table**: aggiungere colonna `platform` (`web` | `ios` | `android`) con **default `'web'`** (le subscription esistenti vengono marcate automaticamente) e colonna opzionale `expo_token`
2. **`register-push` edge function**: aggiungere supporto per token Expo/nativi tramite parametro opzionale `platform`. Se non passato (come fa la PWA), il comportamento resta identico
3. **`send-expiry-notifications` edge function**: aggiungere un ramo per inviare via Expo Push API alle subscription native. Le subscription `web` continuano via Web Push come oggi
4. **Deep linking**: hostare `.well-known/apple-app-site-association` e `assetlinks.json` su `entroapp.it` (file statici, nessun impatto sulla PWA)

## Configurazione Supabase per React Native

Differenza chiave rispetto al client web:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: AsyncStorage,       // ← invece di localStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // ← false su mobile (no URL fragments)
  },
})
```

---

## Verifica End-to-End

- [ ] Auth: login, signup, logout, reset password su iOS e Android
- [ ] CRUD: creare, modificare, eliminare, cambiare stato alimenti
- [ ] Barcode: scansione e auto-fill da Open Food Facts
- [ ] Realtime: modifica da dispositivo A → appare su dispositivo B
- [ ] Offline: CRUD funziona offline, sync al ritorno online
- [ ] Push: notifiche scadenza ricevute su entrambe le piattaforme
- [ ] Inviti: creare invito e accettarlo da deep link
- [ ] Calendario: vista 7 giorni con navigazione swipe
- [ ] Dark mode: switch funzionante
- [ ] Export: download JSON via share sheet nativo
- [ ] Haptics: feedback su swipe, create, delete
- [ ] **PWA invariata**: verificare che la web app su `entroapp.it` funziona identicamente dopo le modifiche backend
