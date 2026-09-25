# 🚀 Deploy Guide - Netlify

Guida passo-passo per deployare **entro** su Netlify.

## 📋 Prerequisiti

- Account Netlify (gratuito): https://app.netlify.com/signup
- Progetto Supabase attivo con database configurato
- Repository GitHub (opzionale ma consigliato)
- Per sviluppo e verifica migration: Docker + Supabase CLI in locale

## 🧪 Supabase locale per sviluppo

Per validare migration e flussi database senza toccare la produzione:

```bash
supabase start
supabase db reset
npm run supabase:types
```

Poi configura `.env.local` con i valori locali stampati dalla CLI:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
VITE_APP_URL=http://localhost:5173
```

Lo staging remoto Supabase è opzionale: sul piano Free può consumare uno dei progetti attivi disponibili. Per default usare Supabase locale.

## 🔧 Step 1: Preparazione Environment Variables

Prima del deploy, prepara i seguenti valori dalle impostazioni Supabase:

1. Vai su: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
2. Copia:
   - `Project URL` → sarà `VITE_SUPABASE_URL`
   - `anon/public key` → sarà `VITE_SUPABASE_ANON_KEY`

## 📦 Step 2A: Deploy da GitHub (Consigliato)

### Push su GitHub
```bash
# Se non l'hai ancora fatto
git add .
git commit -m "feat: add Netlify configuration for deployment"
git push origin main
```

### Deploy su Netlify
1. Vai su https://app.netlify.com/
2. Click **"Add new site"** → **"Import an existing project"**
3. Seleziona **GitHub** e autorizza Netlify
4. Scegli il repository `entro`
5. Configura build settings (dovrebbero essere già corretti grazie a `netlify.toml`):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Click **"Add environment variables"** e aggiungi quelle che `netlify.toml` non contiene:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_VAPID_PUBLIC_KEY=your-vapid-public-key-here
   VITE_KOFI_URL=https://ko-fi.com/your-id
   ```
   `VITE_VAPID_PUBLIC_KEY` è la chiave pubblica della stessa coppia che va nel secret `VAPID_KEYS` (Step 4): senza, le notifiche push non si attivano. `VITE_KOFI_URL` è facoltativa: vuota, il pulsante Ko-fi non compare. `VITE_APP_NAME` e i flag `VITE_ENABLE_*` sono già in `netlify.toml`; dei flag il codice legge solo `VITE_ENABLE_SHARED_LISTS`.
7. Click **"Deploy site"**

## 🚀 Step 2B: Deploy da CLI (Alternativa)

### Installa Netlify CLI
```bash
npm install -g netlify-cli
```

### Login
```bash
netlify login
```

### Deploy
```bash
# Build locale
npm run build

# Deploy
netlify deploy --prod
```

Segui le istruzioni interattive per configurare il sito.

## 🔐 Step 3: Configurare Environment Variables su Netlify

Se non l'hai fatto durante il deploy:

1. Vai su **Site settings** → **Environment variables**
2. Click **"Add a variable"**
3. Aggiungi tutte le variabili necessarie (vedi Step 1)

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` devono vivere nelle environment variables Netlify, non in `netlify.toml`.
Le impostazioni non sensibili possono restare in `netlify.toml`: la documentazione Netlify conferma che il file puo' dichiarare environment variables di build e che, in caso di conflitto, la configurazione nel file sovrascrive la UI. Per valori sensibili o ruotabili, usare UI/CLI/API Netlify.

**IMPORTANTE**: Dopo aver aggiunto le env vars, fai un **re-deploy**:
- Vai su **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

`VITE_APP_URL` non va impostata nella UI: `netlify.toml` la fissa a `https://entroapp.it`, e il file vince. Oggi nessun file di `src/` la legge; i link che l'app costruisce (invito, reset della password) partono da `window.location.origin`.

## 🗄️ Step 4: Supabase — migrazioni, Edge Functions, secret e cron

Netlify pubblica solo il frontend. Database, Edge Functions e cron si pubblicano sul progetto Supabase con la Supabase CLI.

### Migrazioni

```bash
supabase link --project-ref <project-ref>
supabase migration list   # quali migrazioni mancano sul remoto
supabase db push
```

La catena canonica è `supabase/migrations/`. La cartella `migrations/` nella radice è un archivio delle migrazioni storiche: non va applicata.

### Edge Functions

Le funzioni sono cinque, in `supabase/functions/`:

| Funzione | Cosa fa |
|---|---|
| `create-invite` | Crea un codice invito per la lista dell'utente |
| `validate-invite` | Controlla un codice durante la registrazione; è pubblica |
| `accept-invite` | Fa entrare l'utente nella lista dell'invito |
| `register-push` | Salva o toglie la sottoscrizione push del browser |
| `send-expiry-notifications` | Manda le notifiche di scadenza; la chiama il cron |

```bash
supabase functions deploy <nome-funzione> --project-ref <project-ref>
```

`supabase/config.toml` dichiara `verify_jwt = false` per tutte e cinque: le quattro che servono a un utente o al cron controllano da sole il token (`supabase/functions/_shared/auth.ts`).

### Secret delle Edge Functions

```bash
supabase secrets set --project-ref <project-ref> \
  VAPID_KEYS='<coppia di chiavi VAPID in JWK, come JSON>' \
  VAPID_SUBJECT='mailto:<indirizzo di contatto>' \
  CRON_SECRET='<segreto condiviso con il cron>'
```

- `VAPID_KEYS`: la coppia di chiavi VAPID in formato JWK. `send-expiry-notifications` la legge con `JSON.parse` e la passa a `importVapidKeys` di `@negrel/webpush`. La chiave pubblica della stessa coppia, in base64url, è `VITE_VAPID_PUBLIC_KEY` su Netlify. Il repo non contiene uno script per generarle.
- `VAPID_SUBJECT`: il contatto dichiarato ai servizi push. Se manca, vale `mailto:support@entroapp.it`: un fork lo imposta con un proprio indirizzo.
- `CRON_SECRET`: `send-expiry-notifications` risponde 401 a chi non lo manda come `Authorization: Bearer <CRON_SECRET>`.
- `ENTRO_ALLOWED_ORIGINS` (facoltativo): altri origin ammessi dal CORS delle funzioni, separati da virgole. Senza, passano solo `https://entroapp.it`, `https://www.entroapp.it` e localhost: un fork su un altro dominio deve impostarlo, o il browser blocca le chiamate.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, che le funzioni leggono in `_shared/supabase.ts`, le fornisce Supabase.

### Cron delle notifiche

Le notifiche partono da un job `pg_cron` che ogni giorno alle 08:00 UTC chiama `send-expiry-notifications` con `pg_net`.

1. Abilita le estensioni `pg_cron` e `pg_net` (Dashboard → Database → Extensions).
2. Salva lo stesso `CRON_SECRET` nel Vault, con il nome che il job legge:
   ```sql
   select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'Shared secret for Edge Function cron auth');
   ```
3. Controlla il job: `select jobname, schedule, command from cron.job;`. La migrazione `20260329_fix_cron_timezone.sql` lo crea con l'URL segnaposto `<SUPABASE_URL>/functions/v1/send-expiry-notifications`, e non fa niente se al momento del `db push` `pg_cron` non era attivo. In entrambi i casi rilancia il blocco SQL di quella migrazione con l'URL del tuo progetto al posto del segnaposto.

## ✅ Step 5: Verificare il Deploy

1. Apri l'URL Netlify nel browser
2. Testa:
   - ✅ Login/Signup funzionano
   - ✅ Dashboard carica correttamente
   - ✅ CRUD alimenti funziona
   - ✅ Upload immagini funziona
   - ✅ Filtri e ricerca funzionano

## 📱 Step 6: Test su Mobile

1. Apri l'URL su iPhone/Android
2. Testa specificamente:
   - ✅ Layout responsive
   - ✅ Upload foto da camera
   - ✅ HEIC/HEIF conversion (iPhone)
   - ✅ Touch interactions
   - ✅ PWA features (opzionale)

## 🐛 Troubleshooting

### Build Fails
- Controlla i logs su Netlify Dashboard → Deploys
- Verifica che tutte le dipendenze siano in `package.json`
- Prova build locale: `npm run build`

### Env Variables Not Working
- Devono iniziare con `VITE_` per essere esposte al client
- Dopo aver modificato env vars, **sempre re-deploy con clear cache**
- Verifica nel browser console che le variabili siano corrette

### Supabase Connection Error
- Verifica `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Controlla che il progetto Supabase sia attivo
- Verifica le Edge Functions: Entro usa CORS ristretto a `https://entroapp.it`, `https://www.entroapp.it`, localhost/127.0.0.1 e agli origin esplicitati in `ENTRO_ALLOWED_ORIGINS`. Non ripristinare `Access-Control-Allow-Origin: *`.

### 404 Errors on Refresh
- Verifica che `netlify.toml` contenga il redirect rule
- Re-deploy con clear cache

## 🔄 Deploy Automatici (CI/CD)

Con GitHub integration, Netlify farà deploy automatico ad ogni push su `main`:
- **Push su main** → Deploy automatico
- **Pull Request** → Deploy preview automatico

## 📊 Custom Domain (Opzionale)

Per usare un dominio personalizzato:
1. **Site settings** → **Domain management**
2. **Add custom domain**
3. Segui le istruzioni per configurare DNS

---

## 🎉 Deploy Completato!

Il tuo MVP è ora live e accessibile da qualsiasi dispositivo via HTTPS! 🚀

**Next Steps**:
- Condividi l'URL per testing con amici/famiglia
- Monitora errori su Netlify Dashboard
- Raccogli feedback da utenti reali
- Itera e migliora! 🎯
