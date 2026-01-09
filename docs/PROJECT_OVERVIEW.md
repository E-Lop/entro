# Project Overview - entro

## 🎯 Visione del Progetto

Entro è una web app moderna e intuitiva che aiuta le persone a ridurre lo spreco alimentare gestendo efficacemente le date di scadenza dei prodotti in casa. L'app combina la semplicità d'uso con funzionalità avanzate come la scansione barcode e notifiche intelligenti.

## 🌟 Obiettivi

### Obiettivi Primari
- Ridurre lo spreco alimentare domestico
- Semplificare la gestione della dispensa/frigo/freezer
- Offrire un'esperienza mobile-first fluida e intuitiva
- Rendere l'inserimento dati veloce e semplice

### Obiettivi Secondari
- Costruire un portfolio project di qualità professionale
- Dimostrare competenze in React, TypeScript e architetture moderne
- Creare una base per potenziali funzionalità future (marketplace, ricette, etc.)

## 👥 Target Utente

### Utente Primario
- **Famiglie** che fanno la spesa settimanale
- Persone che vogliono ridurre gli sprechi
- Chi ha difficoltà a ricordare le scadenze
- Età: 25-55 anni
- Tech-savvy: livello medio

### Use Cases Principali
1. **Mamma di famiglia**: Gestisce spesa per 4 persone, vuole evitare di buttare cibo
2. **Single professionista**: Fa spesa irregolare, perde traccia di cosa ha in frigo
3. **Coppia eco-conscious**: Vuole minimizzare gli sprechi per sostenibilità
4. **Coinquilini**: Condividono frigorifero e devono coordinare acquisti

## 🎨 User Experience

### Principi di Design
1. **Mobile-First**: La maggior parte degli utenti userà l'app mentre è in cucina/supermercato
2. **Quick Input**: Inserire un alimento deve richiedere <30 secondi
3. **Visual First**: Card con immagini sono più immediate di liste testuali
4. **Notifiche Proattive**: L'app ti avvisa prima che sia troppo tardi
5. **Zero Learning Curve**: Funzionalità intuitive che non richiedono tutorial

### User Journey Tipico

```
1. Torna dal supermercato
   ↓
2. Apre app e scansiona barcode prodotti
   ↓
3. App riconosce prodotto e pre-compila dati
   ↓
4. Utente conferma/modifica data scadenza
   ↓
5. Prodotto salvato con immagine e categoria
   ↓
... 3 giorni prima della scadenza ...
   ↓
6. Riceve notifica: "La mozzarella scade tra 3 giorni"
   ↓
7. Apre app, vede card evidenziata in giallo
   ↓
8. Consuma il prodotto, swipe per eliminare
```

## 🚀 Proposta di Valore

### Differenziatori Chiave

1. **Scansione Barcode Veloce**
   - Nessuna app competitor in Italia offre barcode + Open Food Facts
   - Inserimento 10x più veloce rispetto a input manuale

2. **Swipe Gestures**
   - Interazione naturale e veloce
   - Riduce friction nell'uso quotidiano

3. **Multi-Storage**
   - Frigo/Freezer/Dispensa separati
   - Rispecchia organizzazione fisica della casa

4. **Vista Calendario**
   - Visualizzazione settimanale/mensile unica
   - Permette pianificazione pasti

5. **PWA = Zero Installation Friction**
   - Nessun download da store
   - Aggiornamenti automatici
   - Funziona su iOS e Android senza distinzioni

## 📊 Metriche di Successo

### MVP (Fase 1-2)
- [ ] 10 utenti beta attivi
- [ ] 80% completion rate inserimento prodotto
- [ ] <5s tempo medio inserimento (con barcode)
- [ ] 0 bug critici in produzione

### Post-MVP (Fase 3-4)
- [ ] 100+ utenti attivi mensili
- [ ] 70% retention rate a 1 mese
- [ ] 50+ prodotti inseriti per utente medio
- [ ] 5+ notifiche agite per utente/settimana

### Long-term
- [ ] 1000+ utenti attivi
- [ ] Database locale di 10k+ prodotti italiani
- [ ] 20% degli utenti usa feature condivisione
- [ ] Feedback positivo >4.5/5

## 🎯 Scope Definition

### ✅ In Scope (MVP)
- CRUD alimenti con tutti i campi core
- Scansione barcode con Open Food Facts
- Filtri e ordinamento base
- Autenticazione email/password
- Notifiche browser
- Vista lista/griglia
- Responsive design mobile/desktop

### 🔄 In Scope (Post-MVP)
- Vista calendario settimanale/mensile
- Swipe gestures mobile
- Upload/modifica immagini custom
- Condivisione liste tra utenti
- Statistiche e analytics
- OCR per date stampate
- Dark mode

### ❌ Out of Scope (Per Ora)
- App native iOS/Android
- Riconoscimento immagini ML avanzato
- Integrazione liste spesa esterne (Todoist, etc.)
- Suggerimenti ricette
- Social features (commenti, like)
- Gamification
- Monetizzazione

## 🏗️ Architettura High-Level

```
┌─────────────┐
│   Browser   │
│ (iOS/Android)│
└──────┬──────┘
       │
       │ HTTPS
       ↓
┌──────────────────┐
│   Netlify CDN    │
│  (Static Host)   │
└──────┬───────────┘
       │
       ├─────────────────┐
       │                 │
       ↓                 ↓
┌─────────────┐   ┌──────────────┐
│  Supabase   │   │ Open Food    │
│  (Backend)  │   │ Facts API    │
│             │   │ (External)   │
│ - Auth      │   └──────────────┘
│ - Database  │
│ - Storage   │
│ - Realtime  │
└─────────────┘
```

## 🗓️ Timeline Overview

- **Fase 1**: Setup & MVP Core (2-3 settimane)
- **Fase 2**: Barcode & Mobile UX (1-2 settimane)
- **Fase 3**: Advanced Features (1-2 settimane)
- **Fase 4**: Polish & Release (1 settimana)

**Totale stimato**: 5-8 settimane part-time

Vedi [ROADMAP.md](ROADMAP.md) per dettagli.

## 💡 Future Possibilities

### Features Potenziali
- **AI Recipe Suggestions**: "Hai mozzarella e pomodori in scadenza? Prova questa ricetta"
- **Shopping List Integration**: Genera lista spesa da alimenti terminati
- **Inventory Value Tracking**: Stima valore economico alimenti in casa
- **Sustainability Metrics**: "Hai evitato X kg di spreco questo mese"
- **Community Features**: Condividi ricette anti-spreco
- **Barcode Creation**: Per prodotti sfusi senza barcode

### Espansioni Business
- Freemium model (free: 50 alimenti, premium: illimitati)
- B2B per ristoranti/mense
- Partnership con GDO per integrazione fidelity cards
- API per terze parti

## 🤔 Rischi e Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Open Food Facts ha pochi prodotti IT | Media | Alto | Database locale + crowdsourcing |
| Utenti non usano barcode scanner | Bassa | Medio | Input manuale comunque fluido |
| Notifiche ignorate | Alta | Medio | Timing intelligente + customizzazione |
| Performance mobile lenta | Bassa | Alto | PWA + lazy loading + optimization |
| Competizione esistente | Media | Medio | Focus su UX superiore + barcode |

## 📚 Riferimenti e Ispirazione

### App Simili (Competitor Analysis)
- **Too Good To Go**: Focus anti-spreco ma B2C
- **NoWaste**: Simile ma UX datata, no barcode
- **FridgePal**: Feature-rich ma complessa
- **Fridge Check**: Solo iOS, basic features

### Design Inspiration
- Todoist (task management UX)
- Notion (database views)
- Apple Reminders (semplicità)

## ✅ Success Criteria

Il progetto è considerato "successful" se:

1. ✅ MVP completato e funzionante in produzione
2. ✅ 10+ utenti beta lo usano regolarmente (>1x/settimana)
3. ✅ Codice pulito e manutenibile (portfolio-ready)
4. ✅ Feedback positivo su UX da utenti test
5. ✅ Zero downtime o bug critici per 1 mese
6. ✅ Documentazione completa e professionale

---

**Prossimi Step**: Vedi [TECHNICAL_SPECS.md](TECHNICAL_SPECS.md) per dettagli implementazione.
