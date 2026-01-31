# Piano: Implementazione GDPR/Privacy Compliance per entro PWA

## 🎯 Obiettivo

Implementare **compliance GDPR completa** per il lancio pubblico di entro in Italia/EU usando **Aruba LegalBlink Advanced**:
- Cookie consent banner con opt-in (fornito da Aruba)
- Privacy Policy e Terms of Service (scritti da consulenti legali Aruba)
- Data export (GDPR Art. 20) - sviluppo interno
- Account deletion (GDPR Art. 17) - sviluppo interno

**Soluzione Scelta**: Aruba LegalBlink Advanced (€47/anno)
**Scope**: Full compliance senza analytics (nessun tracking attivo)
**Timeline**: 3-4 giorni (setup Aruba + sviluppo GDPR tools)

---

## 📊 Situazione Attuale

### Cosa Raccoglie entro
- **Supabase Auth**: email, password (hashed), nome
- **Database**: foods, immagini, shared lists, invite codes
- **localStorage**: `entro-theme` (tema), swipe hints flags, welcome toast
- **Service Worker**: cache assets, fonts, signed URLs

### Cosa Manca
❌ Privacy Policy (→ Aruba LegalBlink)
❌ Terms of Service (→ Aruba LegalBlink)
❌ Cookie consent banner (→ Aruba LegalBlink)
❌ Data export (→ sviluppo interno)
❌ Account deletion GDPR-compliant (→ sviluppo interno)

### Requisiti Legali Italia 2026
- localStorage/sessionStorage considerati "cookie-like storage" → richiedono consenso se non strettamente necessari
- Service Worker PWA non è "strictly necessary" → richiede consenso
- Opt-in esplicito (no pre-checked boxes)
- No script/storage caricati prima del consenso

**Fonti**: [CookieYes Italy](https://www.cookieyes.com/blog/cookie-consent-requirements-in-italy/), [Beyond The Sketch PWA Cookies](https://www.beyondthesketch.com/developer/pwa-and-cookies/)

---

## 💰 Aruba LegalBlink Advanced - Dettagli

### Cosa Include (€47/anno)
✅ **Privacy Policy personalizzata** - scritta da consulenti legali
✅ **Terms & Conditions** - personalizzati per food tracking app
✅ **Cookie Policy** - completa e GDPR-compliant
✅ **Cookie Consent Banner** - customizable, GDPR-ready
✅ **Audit sito web** - consulenti analizzano entro
✅ **Google Consent Mode** - integrato
✅ **Multilingua** - IT, EN, DE, FR, ES
✅ **Testi banner personalizzati** - per il tuo caso d'uso
✅ **Consegna 3 giorni lavorativi** - documenti via email

### Perché Aruba Advanced vs Altre Opzioni

| Aspetto | Aruba Advanced | Iubenda | Sviluppo Interno |
|---------|----------------|---------|------------------|
| **Costo annuale** | €47 | €120 | €0 (ma 5-6 giorni) |
| **Setup** | 3 giorni | 1 giorno | 5-6 giorni |
| **Privacy Policy** | Consulenti legali | Lawyer-drafted | Da scrivere + lawyer (€200-500) |
| **Terms & Conditions** | ✅ Inclusi | ✅ Inclusi | ❌ Da scrivere |
| **Cookie Banner** | ✅ Fornito | ✅ Fornito | Da sviluppare |
| **Provider** | Già tuo (dominio) | Terza parte | Nessuno |
| **Support** | Italiano | Italiano/EN | Nessuno |

**Decisione**: Aruba vince su costo (€47 vs €120 vs €200-500+tempo) e include consulenza legale.

---

## 🏗️ Architettura Implementazione

### Cosa Fornisce Aruba (Non Sviluppare)
✅ Cookie consent banner (script Aruba)
✅ Privacy Policy (pagina o embed)
✅ Cookie Policy (pagina o embed)
✅ Terms & Conditions (pagina o embed)

### Cosa Sviluppare Internamente (GDPR Tools)
🔨 Data Export (GDPR Art. 20)
🔨 Account Deletion (GDPR Art. 17)
🔨 Settings page per gestione dati utente
🔨 Link a documenti Aruba nel footer

### Classificazione Storage (per Cookie Banner Aruba)

**Strictly Necessary** (cookie tecnici - nessun consenso richiesto):
- ✅ Supabase Auth session
- ✅ Session processing flags

**Preferenze/Funzionali** (consenso opzionale):
- 🍪 Theme localStorage (`entro-theme`)
- 🍪 Swipe hints flags
- 🍪 Service Worker / PWA caching
- 🍪 Welcome toast flags

**Nota**: Aruba banner gestirà il consenso, noi leggeremo lo stato del consenso per abilitare/disabilitare features.

---

## 📋 Fasi di Implementazione

### **Fase 1: Attivazione Aruba LegalBlink** (Giorno 1 - 2 ore)
Setup servizio Aruba

**Tasks**:
1. Accedi a pannello Aruba hosting
2. Acquista LegalBlink Advanced (€47/anno)
3. Compila form audit:
   - URL sito: https://entroapp.it
   - Descrizione: PWA food expiry tracker con Supabase backend
   - Dati raccolti: email, password, nome, foods, immagini, shared lists
   - Cookie/storage: localStorage (theme, hints), Service Worker cache
   - Terze parti: Supabase, Open Food Facts API
4. Invia richiesta documenti

**Deliverables**:
- ✅ Servizio attivato
- ✅ Richiesta documenti inviata
- ✅ Attesa 3 giorni lavorativi per consegna

**Tempo**: 1-2 ore setup

---

### **Fase 2: Settings Page & GDPR Tools** (Giorno 1-2 - 10 ore)
Mentre aspetti documenti Aruba, sviluppa GDPR tools

**File da creare**:
- `src/pages/SettingsPage.tsx` - Dashboard settings
- `src/components/settings/AccountSection.tsx` - Info profilo
- `src/components/settings/DataExportButton.tsx` - Export dati
- `src/components/settings/DeleteAccountDialog.tsx` - Cancellazione account
- `src/lib/dataExport.ts` - Logica export JSON

**Layout Settings Page**:
```
Account Settings
├─ Profile
│  ├─ Email: user@example.com
│  └─ Nome: Mario Rossi
├─ Privacy & Data
│  ├─ [Esporta i Miei Dati] (GDPR Art. 20)
│  ├─ [Privacy Policy] (link Aruba)
│  └─ [Cookie Policy] (link Aruba)
└─ Danger Zone
   └─ [Elimina Account] (red, GDPR Art. 17)
```

**Componenti shadcn/ui**: Card, Button, AlertDialog, Input

**Route**: `/settings` (protected)

**File da modificare**:
- `src/App.tsx` - Aggiungere route `/settings`
- `src/components/layout/AppLayout.tsx` - Link "Impostazioni" in user menu

---

### **Fase 3: Data Export Implementation** (Parte di Fase 2 - 4 ore)
GDPR Art. 20 - Right to Data Portability

**Funzionalità `dataExport.ts`**:
```typescript
export async function exportUserData() {
  // 1. Fetch user profile
  const user = await getCurrentUser();

  // 2. Fetch all foods
  const foods = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', user.id);

  // 3. Fetch lists & memberships
  const lists = await getUserLists();

  // 4. Generate JSON
  const exportData = {
    exportDate: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.user_metadata.full_name,
      createdAt: user.created_at,
    },
    foods: foods.data,
    lists: lists,
    note: "Image signed URLs expire in 1 hour"
  };

  // 5. Download file
  downloadJSON(exportData, `entro-export-${Date.now()}.json`);
}
```

**UI Component**: Button con loading state, toast success/error

---

### **Fase 4: Account Deletion Implementation** (Parte di Fase 2 - 4 ore)
GDPR Art. 17 - Right to Erasure

**Flow `DeleteAccountDialog.tsx`**:
```
User clicks [Elimina Account]
    ↓
AlertDialog warning:
"Attenzione: questa azione è irreversibile.
Tutti i tuoi dati saranno eliminati permanentemente:
- Profilo utente
- Tutti gli alimenti (X totali)
- Immagini caricate
- Liste condivise
- Inviti pendenti"
    ↓
[Annulla] | [Capisco, elimina il mio account]
    ↓
Password re-authentication input
    ↓
async deleteAccount():
  1. Verify password
  2. Delete from Supabase Storage (images)
  3. supabase.auth.admin.deleteUser(user.id)
     - Cascade deletes: foods, list_members, invites (via RLS)
  4. localStorage.clear()
  5. sessionStorage.clear()
  6. Navigate to /goodbye
```

**Goodbye Page**: Simple message "Account eliminato. Grazie per aver usato entro."

---

### **Fase 5: Integrazione Documenti Aruba** (Giorno 4 - 3 ore)
Dopo ricezione email da Aruba (giorno 3-4)

**Tasks**:
1. Ricevi email Aruba con:
   - Privacy Policy (HTML o link)
   - Cookie Policy (HTML o link)
   - Terms & Conditions (HTML o link)
   - Cookie banner script

2. **Integra Cookie Banner**:
   - Aggiungi script Aruba in `index.html` o `App.tsx`
   - Verifica posizionamento (bottom banner)
   - Test consenso: Accept/Reject/Customize

3. **Crea pagine documenti**:
   - `src/pages/PrivacyPolicyPage.tsx` - Embed/iframe Aruba doc
   - `src/pages/TermsPage.tsx` - Embed/iframe Aruba doc
   - Route `/privacy`, `/terms`

4. **Aggiungi Footer**:
   - `src/components/layout/Footer.tsx`
   - Link: Privacy Policy | Cookie Policy | Terms
   - Aggiungi a Login, Signup, Dashboard

5. **Signup checkbox**:
   - `src/pages/SignUpPage.tsx`
   - Checkbox required: "Accetto i [Termini] e la [Privacy Policy]"

**File da modificare**:
- `index.html` o `App.tsx` - Script cookie banner Aruba
- `App.tsx` - Routes `/privacy`, `/terms`
- `LoginPage.tsx`, `SignUpPage.tsx` - Footer
- `SignUpPage.tsx` - Checkbox accettazione

---

### **Fase 6: Testing & Validation** (Giorno 4 - 3 ore)
Compliance & funzionalità

**Test Cookie Banner Aruba**:
1. ✅ Prima visita: banner appare
2. ✅ Accept All: cookie consentiti salvati
3. ✅ Reject All: solo cookie necessari
4. ✅ Customize: selezione granulare funziona
5. ✅ Banner non riappare dopo scelta
6. ✅ Link a Privacy/Cookie policy funzionano

**Test GDPR Tools**:
1. ✅ Data export genera JSON completo
2. ✅ JSON include user, foods, lists
3. ✅ Download funziona (file nome corretto)
4. ✅ Account deletion:
   - Richiede password
   - Elimina tutti i dati
   - Logout corretto
   - Redirect a /goodbye
5. ✅ Settings page responsive mobile

**Test Documenti**:
1. ✅ Privacy Policy accessibile da `/privacy` e footer
2. ✅ Terms accessibili da `/terms` e footer
3. ✅ Cookie Policy link funziona
4. ✅ Signup checkbox blocca registrazione se non checked

**Compliance Checklist**:
- [ ] Privacy policy completa (scritta da consulenti Aruba)
- [ ] Terms & Conditions presenti
- [ ] Cookie banner funzionante
- [ ] Consenso opt-in (gestito da Aruba)
- [ ] Data export include TUTTI i dati personali
- [ ] Account deletion rimuove TUTTI i dati

---

## 📁 File da Creare/Modificare

### Nuovi da Creare (8 files)
1. **`src/pages/SettingsPage.tsx`** - Dashboard impostazioni utente
2. **`src/components/settings/AccountSection.tsx`** - Sezione profilo
3. **`src/components/settings/DataExportButton.tsx`** - Export dati GDPR
4. **`src/components/settings/DeleteAccountDialog.tsx`** - Cancellazione account
5. **`src/lib/dataExport.ts`** - Logica export JSON
6. **`src/components/layout/Footer.tsx`** - Footer con link Privacy/Terms
7. **`src/pages/PrivacyPolicyPage.tsx`** - Embed documento Aruba
8. **`src/pages/TermsPage.tsx`** - Embed documento Aruba

### Esistenti da Modificare (4 files)
1. **`src/App.tsx`**
   - Aggiungere routes: `/settings`, `/privacy`, `/terms`
   - (Opzionale) Integrare script Aruba cookie banner

2. **`src/components/layout/AppLayout.tsx`**
   - Aggiungere link "Impostazioni" in user menu dropdown

3. **`src/pages/SignUpPage.tsx`**
   - Aggiungere checkbox: "Accetto i [Termini] e la [Privacy Policy]" (required)
   - Aggiungere Footer component

4. **`src/pages/LoginPage.tsx`**
   - Aggiungere Footer component

### File NON Necessari (grazie ad Aruba)
❌ `consent.ts` - Aruba gestisce consent
❌ `useConsent.ts` - Non serve custom hook
❌ `CookieBanner.tsx` - Fornito da Aruba
❌ `ConsentDialog.tsx` - Fornito da Aruba
❌ Modifica `useTheme.ts` - Aruba banner gestisce consent
❌ Modifica `vite.config.ts` - Non necessario se Aruba gestisce SW consent

---

## ⚖️ Decisioni Chiave

### 1. Soluzione Privacy - Aruba LegalBlink Advanced
**Decisione**: Usare servizio Aruba invece di sviluppo interno
**Costo**: €47/anno (vs €120 Iubenda, vs €200-500 lawyer + 5-6 giorni)
**Razionale**:
- Include consulenti legali che scrivono documenti personalizzati
- Terms & Conditions inclusi (Basic non li ha)
- Già cliente Aruba (dominio) → integrazione facile
- €47 totale < €124 (Basic €24 + lawyer T&C €100)
- Risparmio €77-177 vs alternative

### 2. Cookie Banner - Fornito da Aruba
**Decisione**: Usare script Aruba invece di custom build
**Razionale**: Già incluso, GDPR-compliant, customizable, Google Consent Mode integrato

### 3. Cosa Sviluppare Internamente
**Decisione**: Solo GDPR tools (Data Export + Account Deletion)
**Razionale**:
- Aruba non fornisce questi tools
- GDPR Art. 20 e 17 richiedono funzionalità nell'app
- 10 ore sviluppo vs 46 ore soluzione completa interna

### 4. Lingua - Italiano + Multilingua Ready
**Decisione**: Aruba fornisce 5 lingue (IT, EN, DE, FR, ES)
**Razionale**: Multilingua incluso senza costo extra

### 5. Immagini in Export
**Decisione**: Export signed URLs (validi 1 ora) con nota nel JSON
**Alternativa**: Base64 (file troppo grande), o solo references
**Razionale**: Bilancia completezza e praticità

### 6. Account Deletion - Cascade via RLS
**Decisione**: Usare Supabase Auth delete + RLS cascade
**Razionale**: Semplice, sicuro, no Edge Function necessaria (per ora)

---

## 🧪 Strategia di Testing

### Test Funzionali
- Consent banner appare/dismisses correttamente
- Service Worker si registra solo con consent
- Theme rispetta consent (fallback a system)
- Settings page aggiorna preferenze
- Data export genera JSON valido
- Account deletion rimuove tutti i dati

### Test Compliance
- Privacy policy completa (GDPR Art. 13)
- Consent opt-in (no pre-checked)
- Features opzionali bloccate senza consent
- User può revocare consent
- Data export completo
- Account deletion totale

### Test UX/Accessibility
- Banner mobile-friendly (non blocca contenuto)
- Keyboard navigation (Tab, Enter, Esc)
- Screen reader compatible
- Color contrast WCAG AA
- Touch targets 44x44px min
- Responsive 320px-1920px

### Edge Cases
- User clear browser data → banner riappare
- User reject → cambia idea in settings
- Export con 0 foods → JSON valido vuoto
- Delete account in shared list → list gestita correttamente
- Multiple tabs → consent sync (o warning)

---

## ⏱️ Timeline Aggiornata con Aruba

**Totale: 3-4 giorni** (16 ore lavoro + 3 giorni attesa Aruba)

### Timeline Dettagliata

| Giorno | Tasks | Ore Lavoro | Output |
|--------|-------|------------|--------|
| **Giorno 1** | Attiva Aruba (2h) + Sviluppo Settings (6h) | 8h | Aruba request sent, Settings 80% |
| **Giorno 2** | Data Export + Account Deletion | 8h | GDPR tools completi |
| **Giorno 3** | ⏳ Attesa documenti Aruba | 0h | Consulenti lavorano |
| **Giorno 4** | Integra documenti + Footer + Testing | 6h | **Launch ready** ✅ |

**Totale ore sviluppo**: 22 ore (vs 46 ore sviluppo interno)
**Risparmio tempo**: 24 ore (3 giorni)

### Breakdown Ore

| Fase | Descrizione | Ore |
|------|-------------|-----|
| Setup Aruba | Attivazione + form audit | 2h |
| Settings Page | Layout + AccountSection | 3h |
| Data Export | Logic + UI + testing | 4h |
| Account Deletion | Flow + password + cascade | 4h |
| Integrazione Aruba | Script banner + docs embed | 3h |
| Footer | Component + links | 1h |
| Signup checkbox | Terms acceptance | 1h |
| Testing | Full compliance test | 3h |
| **TOTALE** | | **22h** |

**vs Sviluppo Interno**: 46 ore (24 ore risparmiate)

---

## ✅ Criteri di Successo

Prima del lancio pubblico:
- ✅ Aruba LegalBlink Advanced attivato (€47/anno)
- ✅ Documenti ricevuti da consulenti Aruba (Privacy, Terms, Cookie)
- ✅ Cookie banner Aruba integrato e funzionante
- ✅ Privacy Policy e Terms accessibili (link footer + pagine dedicate)
- ✅ User può esportare dati (JSON completo)
- ✅ User può cancellare account (GDPR Art. 17)
- ✅ Signup richiede accettazione Terms + Privacy
- ✅ Settings page completa e responsive
- ✅ Tutti i test checklist superati
- ✅ Mobile UX fluida e accessibile

**Note**: Privacy Policy è scritta da consulenti legali Aruba, non serve lawyer review addizionale

---

## 🚨 Note Importanti

### Vantaggi Aruba LegalBlink
✅ **Documenti scritti da consulenti legali** - no lawyer review necessaria
✅ **Personalizzati per entro** - non template generici
✅ **GDPR-compliant per legge** - Aruba si assume responsabilità compliance
✅ **Aggiornamenti automatici** - se normative cambiano, Aruba aggiorna documenti
✅ **Support italiano** - per domande legali/tecniche

### Responsabilità Post-Lancio
- **Aruba gestisce**: Privacy Policy, Cookie Policy, Terms (aggiornamenti normativi)
- **Tu gestisci**: Data export, account deletion, consent implementation
- **Condivisa**: Rispondere a richieste GDPR utenti entro 30 giorni

### Quando Contattare Aruba
- Se aggiungi nuove feature che raccolgono dati diversi
- Se integri analytics/tracking (serve aggiornamento Cookie Policy)
- Se cambi terze parti (es. da Supabase a altro backend)
- Ogni 12 mesi: review documenti per verificare ancora accurati

### Costi Annuali
- **Anno 1**: €47 (LegalBlink Advanced)
- **Anno 2+**: €47/anno rinnovo automatico
- **Cancellazione**: Possibile in ogni momento, no lock-in

**ROI**: €47/anno vs €200-500 lawyer one-time + 24 ore sviluppo risparmiato = **conveniente**

---

## ☕ Feature Futura: Donazioni Ko-fi (Opzionale)

### Implementazione Raccomandata: Link Esterno

Se in futuro decidi di aggiungere un sistema di donazioni volontarie, ecco come farlo senza impatto GDPR:

**Privacy Impact**: ✅ **Zero**
- entro NON raccoglie dati di pagamento
- Ko-fi/PayPal gestiscono tutto
- Nessun cookie terze parti
- Nessun consent necessario

### Implementazione Tecnica

**1. Crea Account Ko-fi/PayPal**:
- Ko-fi: https://ko-fi.com/signup
- Ottieni URL: `https://ko-fi.com/entroapp`

**2. Aggiungi Link in Footer** (`src/components/layout/Footer.tsx`):
```tsx
import { Coffee } from 'lucide-react';

<a
  href="https://ko-fi.com/entroapp"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  <Coffee className="h-4 w-4" />
  Offrimi un caffè
</a>
```

**3. Update Privacy Policy via Aruba**:

Quando attivi le donazioni, apri ticket Aruba Support:

```
Oggetto: Aggiornamento Privacy Policy - Link Ko-fi

Testo:
Ciao,
ho aggiunto un link a Ko-fi per donazioni volontarie.
Serve aggiungere questa clausola nella Privacy Policy:

"7.5 Link a Servizi Esterni per Donazioni

Il sito contiene link a servizi di terze parti (Ko-fi/PayPal)
per donazioni volontarie. Quando l'utente clicca su questi link,
lascia entro e accede a piattaforme esterne con proprie privacy
policy. entro non raccoglie né processa dati di pagamento."

Grazie!
```

**Tempo risposta Aruba**: 1-3 giorni lavorativi
**Costo**: €0 (incluso in Advanced)

### Alternative Future (NON Raccomandate per Side Project)

#### Widget Embedded Ko-fi
**Privacy Impact**: ⚠️ Medio (cookie terze parti, serve consent)
**Quando**: Se vuoi widget visibile nella pagina (non solo link)
**Costo Aruba**: Incluso (banner gestisce categoria "Donation widgets")

#### Stripe/Paddle Integrato
**Privacy Impact**: ❌ Alto (raccogli dati pagamento, PCI compliance)
**Quando**: Solo se diventa business serio con subscriptions
**Costo Aruba**: Richiede audit aggiuntivo (€39-47 one-time)
**Tempo**: 5-7 giorni review

### Raccomandazione

**Per entro side project**: Usa **link esterno** Ko-fi
- Zero impatto privacy
- Zero consent necessario
- Update Privacy Policy minimo (1 ticket Aruba)
- Implementazione: 30 minuti
- Costo: €0

**Upgrade futuro**: Se app decolla e vuoi widget → contatta Aruba per update

---

## 📚 Risorse

### Aruba LegalBlink
- [Aruba LegalBlink Service](https://hosting.aruba.it/en/legalblink.aspx)
- [Aruba GDPR Guide](https://guide.hosting.aruba.it/supersite-aruba/supersite/privacy-cookie-e-legale.aspx)
- Pannello Aruba: hosting.aruba.it
- Support: Ticket da pannello clienti o email

### GDPR Legale
- [CookieYes - Italy Cookie Consent](https://www.cookieyes.com/blog/cookie-consent-requirements-in-italy/)
- [Beyond The Sketch - PWA and Cookies](https://www.beyondthesketch.com/developer/pwa-and-cookies/)
- [Supabase GDPR Discussion](https://github.com/orgs/supabase/discussions/2341)

**GDPR Articles**:
- Art. 13: Informazioni al data subject
- Art. 15: Right to access
- Art. 17: Right to erasure
- Art. 20: Right to data portability

### Tools Sviluppo
- shadcn/ui: Dialog, Button, Card, AlertDialog, Input
- React: useState, useEffect
- Supabase: supabase.auth.admin.deleteUser()
- Browser: Blob API per download JSON

### Donazioni (Future)
- Ko-fi: https://ko-fi.com/signup
- PayPal: https://www.paypal.com/donate/buttons

---

**Documento creato**: 31 Gennaio 2026
**Ultima modifica**: 31 Gennaio 2026
**Status**: Production Ready
