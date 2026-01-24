# Guida Configurazione Dominio entroapp.it

**Data creazione**: 24 Gennaio 2026
**Dominio**: entroapp.it (acquistato su Aruba)
**Hosting**: Netlify
**Email provider**: Resend

---

## 📋 Panoramica

Questa guida ti aiuta a configurare:
1. Dominio personalizzato su Netlify
2. Record DNS su Aruba
3. Servizio email con Resend

---

## 1️⃣ NETLIFY - Configurazione Dominio

### Step 1: Aggiungi Dominio Personalizzato

1. Vai su [Netlify Dashboard](https://app.netlify.com/)
2. Seleziona il sito **entro** (attualmente `entro-il.netlify.app`)
3. Vai su **Domain settings** o **Site settings → Domain management**
4. Clicca **Add custom domain**
5. Inserisci: `entroapp.it`
6. Conferma e procedi

### Step 2: Configura www (opzionale ma consigliato)

1. Nella stessa sezione, aggiungi anche: `www.entroapp.it`
2. Netlify configurerà automaticamente il redirect da www → dominio principale

### Step 3: Abilita HTTPS

1. Netlify abiliterà automaticamente il certificato SSL gratuito (Let's Encrypt)
2. Attendi 1-2 minuti dopo che il dominio è verificato
3. Verifica che il badge **HTTPS** sia attivo e verde

---

## 2️⃣ ARUBA - Configurazione DNS

### Accesso al Pannello DNS

1. Vai su [https://www.aruba.it](https://www.aruba.it)
2. Login con le tue credenziali
3. Vai su **Pannello di Controllo → Domini**
4. Seleziona **entroapp.it**
5. Cerca la sezione **Gestione DNS** o **DNS Management**

### Record DNS per Netlify

Configura questi record DNS:

#### Record A (IPv4)
```
Type: A
Name: @ (o lascia vuoto per il dominio root)
Value: 75.2.60.5
TTL: 3600
```

#### Record AAAA (IPv6) - Opzionale ma consigliato
```
Type: AAAA
Name: @ (o lascia vuoto)
Value: 2600:1f18:2148:bc01::53
TTL: 3600
```

#### Record CNAME per www
```
Type: CNAME
Name: www
Value: entro-il.netlify.app
TTL: 3600
```

**Note**:
- Se Aruba mostra un errore sul record A con nome "@", prova a lasciare il campo vuoto
- Alcuni provider usano "@" per il dominio root, altri lasciano il campo vuoto
- TTL (Time To Live) in secondi: 3600 = 1 ora

### Tempo di Propagazione

- **Minimo**: 5-15 minuti
- **Tipico**: 1-2 ore
- **Massimo**: 48 ore (raro)

Per verificare la propagazione DNS, usa:
- [whatsmydns.net](https://www.whatsmydns.net/) (inserisci entroapp.it)
- Comando terminal: `dig entroapp.it` o `nslookup entroapp.it`

---

## 3️⃣ RESEND - Configurazione Email

### Step 1: Crea Account Resend

1. Vai su [https://resend.com](https://resend.com)
2. Clicca **Sign Up**
3. Crea account con email o GitHub
4. Piano gratuito: **100 email/giorno** (sufficiente per iniziare)

### Step 2: Aggiungi il Dominio

1. Nel dashboard Resend, vai su **Domains**
2. Clicca **Add Domain**
3. Inserisci: `entroapp.it`
4. Clicca **Add**

### Step 3: Configura Record DNS per Email

Resend ti mostrerà 3 record DNS da aggiungere su Aruba. Esempio:

#### Record SPF (TXT)
```
Type: TXT
Name: @ (o lascia vuoto)
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

#### Record DKIM (TXT)
```
Type: TXT
Name: resend._domainkey
Value: [valore lungo fornito da Resend - copia esattamente]
TTL: 3600
```

#### Record DMARC (TXT) - Opzionale ma consigliato
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@entroapp.it
TTL: 3600
```

**IMPORTANTE**:
- **Non usare i valori d'esempio sopra!**
- Copia i valori ESATTI dal dashboard Resend
- Il valore DKIM è unico per il tuo account

### Step 4: Verifica il Dominio

1. Dopo aver aggiunto i record DNS su Aruba, torna su Resend
2. Clicca **Verify DNS records**
3. Resend controllerà i record (può richiedere qualche minuto)
4. Quando tutto è verde ✅, il dominio è verificato

### Step 5: Crea API Key

1. Su Resend, vai su **API Keys**
2. Clicca **Create API Key**
3. Configurazione:
   - **Name**: `Entro Production`
   - **Permission**: `Sending access`
   - **Domain**: `entroapp.it`
4. Clicca **Create**
5. **COPIA SUBITO LA CHIAVE** (inizia con `re_...`)
6. Salvala in un posto sicuro (non potrai rivederla dopo)

---

## 4️⃣ CONFIGURAZIONE PROGETTO

### Step 1: Aggiorna Variabili d'Ambiente su Netlify

1. Vai su Netlify Dashboard → tuo sito
2. **Site settings → Environment variables**
3. Aggiungi queste variabili:

```
RESEND_API_KEY = re_your_actual_api_key_here
VITE_RESEND_FROM_EMAIL = noreply@entroapp.it
```

4. Salva le modifiche

### Step 2: Rideploy il Sito

Dopo aver aggiornato le variabili d'ambiente:

1. Vai su **Deploys** nel Netlify Dashboard
2. Clicca **Trigger deploy → Clear cache and deploy site**

Oppure da terminale:
```bash
git push origin main
# Netlify farà automaticamente il deploy
```

### Step 3: Verifica la Configurazione

Dopo il deploy, verifica:

1. **Dominio principale**: https://entroapp.it (deve caricare l'app)
2. **Subdomain www**: https://www.entroapp.it (deve redirectare a entroapp.it)
3. **HTTPS**: Deve avere il lucchetto verde nel browser
4. **Redirect vecchio URL**: https://entro-il.netlify.app (deve ancora funzionare)

---

## 5️⃣ PROSSIMI STEP - Integrazione Email

### Caso d'uso Email in Entro

Attualmente l'app usa Supabase Auth per:
- Signup/Login
- Password reset (Supabase invia le email)

**Possibili usi futuri di Resend**:
1. **Email di benvenuto personalizzate** (dopo signup)
2. **Inviti a liste condivise** via email (in aggiunta ai codici)
3. **Notifiche scadenze** (es: "3 alimenti scadono domani")
4. **Newsletter** (features, tips, aggiornamenti)

### Integrazione Base con Resend

Per inviare email dal tuo codice, dovrai:

#### Backend: Netlify Functions (consigliato)

Crea una Netlify Function per inviare email in modo sicuro:

```typescript
// netlify/functions/send-email.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function handler(event) {
  try {
    const { to, subject, html } = JSON.parse(event.body);

    const data = await resend.emails.send({
      from: 'Entro <noreply@entroapp.it>',
      to,
      subject,
      html,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: data.id }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}
```

#### Frontend: Chiamata alla Function

```typescript
// src/lib/email.ts
export async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html }),
  });

  return response.json();
}
```

**Nota**: Questa integrazione è opzionale e può essere implementata in Fase 6 o successive.

---

## 📊 CHECKLIST CONFIGURAZIONE

### Netlify
- [ ] Dominio personalizzato aggiunto: `entroapp.it`
- [ ] Subdomain www configurato: `www.entroapp.it`
- [ ] HTTPS abilitato (certificato SSL)
- [ ] Variabili d'ambiente Resend aggiunte
- [ ] Deploy completato con successo

### Aruba DNS
- [ ] Record A configurato: `@ → 75.2.60.5`
- [ ] Record AAAA configurato (opzionale): `@ → 2600:1f18:2148:bc01::53`
- [ ] Record CNAME configurato: `www → entro-il.netlify.app`
- [ ] Record SPF (TXT) per Resend configurato
- [ ] Record DKIM (TXT) per Resend configurato
- [ ] Record DMARC (TXT) per Resend configurato (opzionale)
- [ ] DNS propagato (verificato con whatsmydns.net)

### Resend
- [ ] Account creato
- [ ] Dominio `entroapp.it` aggiunto
- [ ] Record DNS verificati ✅
- [ ] API Key creata e salvata
- [ ] Test email inviata con successo

### Verifica Finale
- [ ] https://entroapp.it carica l'app
- [ ] https://www.entroapp.it redirecta correttamente
- [ ] Certificato HTTPS valido
- [ ] App funziona correttamente sul nuovo dominio
- [ ] Supabase Auth funziona (login/signup)

---

## 🔧 TROUBLESHOOTING

### Problema: "DNS not found" o "This site can't be reached"

**Causa**: DNS non ancora propagato o record configurati male

**Soluzione**:
1. Attendi 1-2 ore per la propagazione DNS
2. Verifica i record DNS su Aruba siano corretti
3. Usa `dig entroapp.it` per controllare la propagazione
4. Svuota la cache DNS locale: `sudo dscacheutil -flushcache` (macOS)

### Problema: "Certificate error" o HTTPS non funziona

**Causa**: Netlify non ha ancora emesso il certificato SSL

**Soluzione**:
1. Attendi che il DNS sia completamente propagato
2. Su Netlify → Domain settings → clicca **Verify DNS configuration**
3. Attendi 1-2 minuti, Netlify emetterà automaticamente il certificato
4. Se persiste, contatta il supporto Netlify

### Problema: Email non vengono inviate da Resend

**Causa**: Record DNS email non verificati

**Soluzione**:
1. Verifica che SPF e DKIM siano configurati correttamente
2. Su Resend → Domains → clicca **Verify DNS records**
3. Attendi 15-30 minuti dopo aver configurato i record
4. Controlla il dominio sia verificato (badge verde ✅)

### Problema: www.entroapp.it non redirecta

**Causa**: Record CNAME non configurato o Netlify non ha il www come alias

**Soluzione**:
1. Verifica il record CNAME su Aruba: `www → entro-il.netlify.app`
2. Su Netlify, aggiungi `www.entroapp.it` come domain alias
3. Abilita l'opzione **Redirect www to main domain**

---

## 📚 RISORSE UTILI

### Documentazione
- [Netlify Custom Domains](https://docs.netlify.com/domains-https/custom-domains/)
- [Netlify DNS Records](https://docs.netlify.com/domains-https/netlify-dns/)
- [Resend Quickstart](https://resend.com/docs/send-with-nodejs)
- [Resend Domain Verification](https://resend.com/docs/dashboard/domains/introduction)

### Tools
- [DNS Propagation Checker](https://www.whatsmydns.net/)
- [SSL Checker](https://www.sslshopper.com/ssl-checker.html)
- [MX Toolbox (DNS/Email)](https://mxtoolbox.com/)

### Supporto
- [Netlify Community](https://answers.netlify.com/)
- [Resend Discord](https://resend.com/discord)
- [Aruba Supporto](https://www.aruba.it/assistenza.aspx)

---

**Ultimo aggiornamento**: 24 Gennaio 2026
**Status**: 🚀 Pronto per la configurazione
