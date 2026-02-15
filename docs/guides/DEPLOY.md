# 🚀 Deploy Guide - Netlify

Guida passo-passo per deployare **entro** su Netlify.

## 📋 Prerequisiti

- Account Netlify (gratuito): https://app.netlify.com/signup
- Progetto Supabase attivo con database configurato
- Repository GitHub (opzionale ma consigliato)

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
6. Click **"Add environment variables"** e aggiungi:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   VITE_APP_NAME=entro
   VITE_ENABLE_BARCODE_SCANNER=true
   VITE_ENABLE_SWIPE_GESTURES=true
   VITE_ENABLE_NOTIFICATIONS=true
   VITE_ENABLE_SHARED_LISTS=false
   ```
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

**IMPORTANTE**: Dopo aver aggiunto le env vars, fai un **re-deploy**:
- Vai su **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

## 🌐 Step 4: Aggiornare VITE_APP_URL

1. Dopo il primo deploy, Netlify ti darà un URL tipo: `https://your-app-name.netlify.app`
2. Torna su **Site settings** → **Environment variables**
3. Aggiungi/aggiorna:
   ```
   VITE_APP_URL=https://your-app-name.netlify.app
   ```
4. Re-deploy il sito (Clear cache and deploy)

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
- Verifica le CORS policies su Supabase (dovrebbe essere `*` di default)

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
