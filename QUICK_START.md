# Quick Start Guide for Claude Code

## 🚀 TL;DR

This is a **React TypeScript web app** for tracking food expiry dates with **barcode scanning**.

**Stack**: React 19 + TypeScript + Vite + Tailwind + Supabase + Netlify

## 📖 Essential Reading (15 minutes)

1. **[CLAUDE_CODE_GUIDE.md](CLAUDE_CODE_GUIDE.md)** ← Start here! (5 min)
2. **[PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)** - What we're building (5 min)
3. **[ROADMAP.md](docs/ROADMAP.md)** - Current status & next steps (5 min)

## ⚡ Setup in 5 Steps

```bash
# 1. Initialize Vite project
npm create vite@latest . -- --template react-ts
npm install

# 2. Install dependencies
npm install @supabase/supabase-js zustand @tanstack/react-query date-fns react-hook-form zod @hookform/resolvers clsx tailwind-merge lucide-react sonner

# 3. Setup Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 4. Setup shadcn/ui
npx shadcn-ui@latest init

# 5. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

## 🎯 Current Objective

**Phase 1, Week 1**: Build MVP Core
- Setup database schema (see [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md))
- Implement authentication
- Create basic CRUD for foods
- Build dashboard with food cards

## 📊 Project Stats

- **Timeline**: 5-8 weeks part-time
- **Current Progress**: 10% (Setup phase)
- **Next Milestone**: MVP Core (Week 2)
- **Target Users**: Families managing food at home

## 🔑 Key Features

### MVP (Phase 1-2)
- ✅ Create/Read/Update/Delete foods
- ✅ Calculate days until expiry
- ✅ Filter by category & storage location
- ✅ Search foods by name
- ✅ User authentication

### Phase 3
- 📷 Barcode scanning (iOS + Android)
- 🔄 Swipe gestures (edit/delete)
- 📅 Calendar view (weekly/monthly)

### Phase 4+
- 🔔 Push notifications
- 📱 PWA (installable)
- 📊 Statistics & analytics
- 👥 List sharing (future)

## 🏗️ Architecture Quick Reference

```typescript
// State Management
- Zustand: Global UI state
- TanStack Query: Server state & caching

// Database
- Supabase PostgreSQL
- Row Level Security enabled
- Tables: foods, categories, users (auth)

// Key Libraries
- html5-qrcode: Barcode scanning
- date-fns: Date manipulation
- react-hook-form + zod: Forms & validation
- shadcn/ui: UI components
```

## 📝 First Tasks

From [ROADMAP.md](docs/ROADMAP.md), Phase 1, Week 1:

**Day 1-2: Database & Auth**
1. [ ] Run Supabase migrations (see DATABASE_SCHEMA.md)
2. [ ] Setup Supabase client in app
3. [ ] Create TypeScript types for database
4. [ ] Implement auth flow (signup/login/logout)

**Day 3-4: Core Components**
5. [ ] Create layout with navigation
6. [ ] Build FoodCard component
7. [ ] Build FoodForm component
8. [ ] Setup React Query hooks

**Day 5-7: CRUD Implementation**
9. [ ] Dashboard page with food grid
10. [ ] CREATE food functionality
11. [ ] UPDATE food functionality
12. [ ] DELETE food with confirmation
13. [ ] Image upload to Supabase Storage

## 🎨 Design Principles

- **Mobile-first**: Most users on phones
- **Quick input**: Add food in <30 seconds
- **Visual feedback**: Clear loading/error states
- **Color-coded expiry**: Green/Yellow/Orange/Red
- **Accessible**: WCAG AA compliance

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Camera not working | Needs HTTPS (or localhost) |
| Supabase 401 error | Check RLS policies + auth token |
| Types not working | Run `npx tsc --noEmit` |
| Build fails | Check import paths use `@/` alias |

## 📚 Full Documentation

When you need more details:
- **Features**: [FEATURES.md](docs/FEATURES.md)
- **Technical Specs**: [TECHNICAL_SPECS.md](docs/TECHNICAL_SPECS.md)
- **Database**: [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- **Barcode**: [BARCODE_INTEGRATION.md](docs/BARCODE_INTEGRATION.md)

## ✅ Definition of Done

Each feature should have:
- [ ] TypeScript types
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design
- [ ] User feedback (toast/modal)
- [ ] Works on mobile

## 🎬 Let's Go!

**Your first command:**
```bash
npm create vite@latest . -- --template react-ts
```

Then follow [CLAUDE_CODE_GUIDE.md](CLAUDE_CODE_GUIDE.md) for detailed setup.

**Questions?** Check the docs in `/docs` folder - everything is documented! 🚀

---

**Remember**: Ship small, working increments. Test on real devices. Get feedback early! 💪
