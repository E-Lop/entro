# entro 🥗📅

Web app per gestire le date di scadenza degli alimenti con scansione barcode integrata.

## 🎯 Caratteristiche Principali

- ✅ Gestione completa scadenze alimentari (CRUD, immagini, categorie)
- 📷 Scansione barcode con Open Food Facts (iOS + Android)
- 👥 Liste condivise multi-utente (codici invito anonimi)
- 🔄 Swipe gestures per edit/delete rapido (mobile)
- 📅 Vista calendario settimanale (rolling 7 giorni)
- 🔍 Filtri avanzati e ricerca in tempo reale
- 🔐 Autenticazione sicura con Supabase Auth
- 🌓 Dark mode (light/dark/system)
- ♿ WCAG AA accessibile
- 📱 Progressive Web App installabile (iOS + Android)

## 🚀 Quick Start

### Prerequisiti

- Node.js 18+ (consigliato via nvm)
- npm o yarn
- Account Supabase (gratuito)
- Account Netlify (opzionale, per deploy)

### Installazione

```bash
# Clone repository
git clone [your-repo-url]
cd food-expiry-tracker

# Installa dipendenze
npm install

# Copia file ambiente
cp .env.example .env.local

# Configura variabili in .env.local
# (vedi sezione Configurazione sotto)

# Avvia development server
npm run dev
```

### Configurazione Supabase

1. Crea un progetto su [supabase.com](https://supabase.com)
2. Vai in Settings → API
3. Copia `Project URL` e `anon/public key`
4. Incollali in `.env.local`
5. Esegui le migrations: vedi `docs/DATABASE_SCHEMA.md`

### Configurazione Open Food Facts

Open Food Facts è gratuito e non richiede API key. L'integrazione è già configurata.

## 🛠️ Stack Tecnologico

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **State Management**: Zustand
- **Barcode**: @zxing/browser
- **Data Fetching**: TanStack Query (React Query)
- **Date Management**: date-fns
- **Deploy**: Netlify

## 📁 Struttura Progetto

```
/
├── docs/                      # Documentazione completa
│   ├── PROJECT_OVERVIEW.md    # Visione e obiettivi
│   ├── TECHNICAL_SPECS.md     # Architettura dettagliata
│   ├── FEATURES.md            # Specifiche funzionalità
│   ├── BARCODE_INTEGRATION.md # Guida barcode scanning
│   ├── DATABASE_SCHEMA.md     # Schema DB + migrations
│   └── ROADMAP.md             # Timeline sviluppo
├── src/
│   ├── components/            # Componenti React
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # Utility e configurazioni
│   ├── stores/                # Zustand stores
│   ├── types/                 # TypeScript types
│   └── pages/                 # Route pages
├── public/                    # Asset statici
└── supabase/                  # Migrations e funzioni
```

## 📚 Documentazione Completa

Per informazioni dettagliate, consulta:

- [📋 Project Overview](docs/PROJECT_OVERVIEW.md) - Visione generale del progetto
- [🏗️ Technical Specs](docs/TECHNICAL_SPECS.md) - Architettura e decisioni tecniche
- [✨ Features](docs/FEATURES.md) - Dettaglio funzionalità
- [📷 Barcode Integration](docs/BARCODE_INTEGRATION.md) - Implementazione barcode scanning
- [🗄️ Database Schema](docs/DATABASE_SCHEMA.md) - Struttura database
- [🗺️ Roadmap](docs/ROADMAP.md) - Piano di sviluppo

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 📦 Build & Deploy

```bash
# Build production
npm run build

# Preview build
npm run preview

# Deploy su Netlify (se configurato)
npm run deploy
```

### Deploy Netlify

1. Connetti repository GitHub a Netlify
2. Configura build command: `npm run build`
3. Imposta publish directory: `dist`
4. Aggiungi environment variables in Netlify dashboard

## 🤝 Contributing

1. Fork il progetto
2. Crea un branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📝 License

[Specifica la tua licenza]

## 👤 Author

Edmondo - [@E-Lop]

## 🙏 Acknowledgments

- [Open Food Facts](https://world.openfoodfacts.org/) - Database prodotti
- [Supabase](https://supabase.com/) - Backend as a Service
- [shadcn/ui](https://ui.shadcn.com/) - UI Components
