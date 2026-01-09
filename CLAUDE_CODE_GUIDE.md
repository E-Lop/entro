# Guide for Claude Code

## 👋 Welcome Claude Code!

This file contains specific instructions for Claude Code to work effectively on this project. All the context from our planning session has been documented in the `/docs` folder.

## 📚 Essential Documentation

**Start by reading these files in order:**

1. **[PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)** - Vision, goals, target users
2. **[TECHNICAL_SPECS.md](docs/TECHNICAL_SPECS.md)** - Stack, architecture, implementation details
3. **[FEATURES.md](docs/FEATURES.md)** - Complete feature specifications
4. **[ROADMAP.md](docs/ROADMAP.md)** - Development timeline and current status

**For specific implementations:**
- **[BARCODE_INTEGRATION.md](docs/BARCODE_INTEGRATION.md)** - Barcode scanning guide
- **[DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** - Database structure and migrations

## 🎯 Current Phase

**Status**: Phase 0 - Initial Setup  
**Progress**: 10% (Repository created, planning complete)  
**Next Milestone**: Phase 1 - MVP Core

## 🚀 Immediate Next Steps

1. **Setup Project Structure**
   ```bash
   npm create vite@latest . -- --template react-ts
   npm install
   ```

2. **Install Core Dependencies**
   ```bash
   # Tailwind CSS
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   
   # shadcn/ui
   npx shadcn-ui@latest init
   
   # Core libraries
   npm install @supabase/supabase-js zustand @tanstack/react-query
   npm install date-fns react-hook-form zod @hookform/resolvers
   npm install clsx tailwind-merge lucide-react sonner
   ```

3. **Configure Supabase**
   - Create project at supabase.com
   - Copy `.env.example` to `.env.local`
   - Fill in Supabase credentials

4. **Setup Database**
   - Run migration from `docs/DATABASE_SCHEMA.md`
   - Verify RLS policies are active

## 🏗️ Architecture Overview

```
Frontend: React 19 + TypeScript + Vite
Styling: Tailwind CSS + shadcn/ui
State: Zustand + TanStack Query
Backend: Supabase (PostgreSQL + Auth + Storage)
Deploy: Netlify
```

## 📁 Recommended Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn components
│   ├── foods/           # Food-related components
│   ├── barcode/         # Scanner components
│   ├── calendar/        # Calendar views
│   ├── layout/          # Layout components
│   └── common/          # Shared components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities & configs
├── stores/              # Zustand stores
├── types/               # TypeScript types
└── pages/               # Page components
```

## 🎨 Design Guidelines

### Component Patterns
- Use shadcn/ui components as base
- Follow mobile-first responsive design
- Implement proper loading states
- Handle errors gracefully
- Use TypeScript strictly

### Code Style
- Functional components with hooks
- Clear prop types with TypeScript
- Meaningful variable names
- Small, focused functions
- Comments for complex logic

### State Management
```typescript
// Zustand for global state
- authStore: user authentication
- foodStore: food items cache
- uiStore: UI state (modals, toasts)
- filterStore: filter preferences

// TanStack Query for server state
- All API calls through React Query
- Automatic caching and revalidation
- Optimistic updates where appropriate
```

## 🔑 Key Implementation Notes

### Authentication Flow
1. User signs up/logs in via Supabase Auth
2. JWT token stored automatically
3. RLS policies enforce data access
4. Protected routes check auth status

### Food Item Flow
1. User creates food (manual or via barcode)
2. Data validated with Zod
3. Saved to Supabase with RLS
4. Image uploaded to Storage bucket
5. React Query cache updated
6. UI reflects changes

### Barcode Scanning
1. Request camera permission
2. Initialize html5-qrcode scanner
3. Detect barcode → query Open Food Facts
4. Pre-fill form with product data
5. User confirms expiry date
6. Save to database

## 📝 Coding Conventions

### File Naming
- Components: `PascalCase.tsx` (e.g., `FoodCard.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useFoods.ts`)
- Utils: `kebab-case.ts` (e.g., `date-utils.ts`)
- Types: `kebab-case.types.ts` (e.g., `food.types.ts`)

### Import Order
```typescript
// 1. React & React libraries
import { useState, useEffect } from 'react'

// 2. External libraries
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'

// 3. Internal components
import { Button } from '@/components/ui/button'
import { FoodCard } from '@/components/foods/FoodCard'

// 4. Hooks & utilities
import { useFoods } from '@/hooks/useFoods'
import { formatDate } from '@/lib/date-utils'

// 5. Types
import type { Food } from '@/types/food.types'

// 6. Styles (if any)
import styles from './Component.module.css'
```

## 🧪 Testing Strategy

### During Development
- Manual testing as you build
- Check responsive design (mobile/desktop)
- Test on real devices when possible
- Verify error states

### Before Committing
- Run `npm run build` to check for errors
- Test critical user flows
- Check console for warnings
- Verify types are correct

## 🐛 Common Pitfalls to Avoid

1. **Don't forget HTTPS**: Camera API requires HTTPS (or localhost)
2. **RLS Policies**: Always test with actual user auth, not admin
3. **Image Optimization**: Compress images before upload
4. **Mobile Performance**: Test barcode scanner on real device
5. **Error Handling**: Always handle API failures gracefully
6. **Type Safety**: Don't use `any`, prefer `unknown` if needed

## 💡 Helpful Commands

```bash
# Development
npm run dev              # Start dev server
npm run dev -- --host    # Expose on network (for mobile testing)

# Build
npm run build           # Production build
npm run preview         # Preview production build

# Type checking
npx tsc --noEmit       # Check types without building

# Linting
npm run lint           # Run ESLint

# Supabase (if installed locally)
npx supabase start     # Start local Supabase
npx supabase db push   # Push migrations
```

## 🔄 Git Workflow

```bash
# Feature branches
git checkout -b feature/food-crud
git checkout -b feature/barcode-scanner

# Commit messages
feat: add food creation form
fix: resolve barcode scanner camera permission
docs: update database schema
refactor: extract date utils to separate file
style: format code with prettier
test: add tests for food CRUD
```

## 📞 Getting Help

If you need clarification on any feature:
1. Check the detailed docs in `/docs` folder
2. Refer to specific sections in FEATURES.md
3. Look at implementation examples in TECHNICAL_SPECS.md
4. Check BARCODE_INTEGRATION.md for scanner details

## ✅ Success Criteria

For each feature you implement, ensure:
- ✅ TypeScript types are correct
- ✅ Error handling is implemented
- ✅ Loading states are shown
- ✅ Responsive design works
- ✅ User feedback is clear
- ✅ Code is readable and maintainable

## 🎯 Your First Task

Start with Phase 1, Week 1, Tasks for Giorno 1-2 from ROADMAP.md:
1. Setup Vite project with React + TypeScript
2. Install and configure Tailwind CSS
3. Initialize shadcn/ui
4. Create basic folder structure
5. Setup Supabase client configuration
6. Create initial types from database schema

**Good luck and happy coding!** 🚀

---

**Pro tip**: When implementing a feature, always:
1. Read the feature spec in FEATURES.md
2. Check technical details in TECHNICAL_SPECS.md
3. Follow the roadmap timeline in ROADMAP.md
4. Commit small, working increments
5. Test on real devices when possible
