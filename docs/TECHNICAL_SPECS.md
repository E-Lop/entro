# Technical Specifications

## 🏗️ Architettura Generale

### Pattern Architetturale
**Client-Server con BaaS (Backend as a Service)**

```
┌─────────────────────────────────────────────────┐
│               Client (Browser)                   │
│  ┌──────────────────────────────────────────┐   │
│  │         React Application                 │   │
│  │  ┌────────────┐  ┌─────────────────┐    │   │
│  │  │   Pages    │  │   Components    │    │   │
│  │  └────────────┘  └─────────────────┘    │   │
│  │  ┌────────────┐  ┌─────────────────┐    │   │
│  │  │   Hooks    │  │   Stores        │    │   │
│  │  └────────────┘  └─────────────────┘    │   │
│  │  ┌──────────────────────────────────┐   │   │
│  │  │        Service Layer             │   │   │
│  │  │  - Supabase Client               │   │   │
│  │  │  - Open Food Facts Client        │   │   │
│  │  │  - Barcode Scanner Service       │   │   │
│  │  └──────────────────────────────────┘   │   │
│  └──────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ↓                       ↓
┌──────────────────┐    ┌──────────────────┐
│    Supabase      │    │  Open Food Facts │
│                  │    │   Public API     │
│ - PostgreSQL     │    │                  │
│ - Auth           │    │ - Product Data   │
│ - Storage        │    │ - Images         │
│ - Realtime       │    │ - Categories     │
└──────────────────┘    └──────────────────┘
```

## 🛠️ Stack Tecnologico

### Frontend

#### Core Framework
- **React 19.0+**
  - Concurrent features
  - Automatic batching
  - Transitions API
  - Server Components ready (future)

- **TypeScript 5.3+**
  - Strict mode enabled
  - Path aliases configurati
  - Type-safe API calls

- **Vite 5.0+**
  - Hot Module Replacement (HMR)
  - Build optimization
  - Code splitting automatico
  - Tree shaking

#### Styling & UI
- **Tailwind CSS 3.4+**
  - JIT compiler
  - Custom theme configuration
  - Mobile-first utilities

- **shadcn/ui**
  - Radix UI primitives
  - Accessibilità built-in
  - Customizable components
  - Components: Button, Card, Dialog, Form, Select, etc.

- **Lucide React**
  - Icon library moderna
  - Tree-shakeable
  - Consistent design

#### State Management
- **Zustand**
  - Lightweight (~1KB)
  - Simple API
  - TypeScript first
  - DevTools integration

```typescript
// Store structure
stores/
├── authStore.ts       // User authentication state
├── foodStore.ts       // Food items management
├── uiStore.ts         // UI state (modals, toasts, etc.)
└── filterStore.ts     // Filters and sorting preferences
```

#### Data Fetching
- **TanStack Query (React Query) 5.0+**
  - Caching automatico
  - Background refetching
  - Optimistic updates
  - Infinite queries (per paginazione)

```typescript
// Query keys structure
const queryKeys = {
  foods: {
    all: ['foods'] as const,
    lists: () => [...queryKeys.foods.all, 'list'] as const,
    list: (filters: FoodFilters) => [...queryKeys.foods.lists(), filters] as const,
    details: () => [...queryKeys.foods.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.foods.details(), id] as const,
  },
  categories: ['categories'] as const,
}
```

#### Utilities
- **date-fns 3.0+**: Date manipulation
- **react-hook-form 7.0+**: Form management
- **zod 3.0+**: Schema validation
- **clsx + tailwind-merge**: Conditional classes
- **html5-qrcode**: Barcode scanning
- **react-swipeable**: Touch gestures
- **react-dropzone**: File uploads
- **sonner**: Toast notifications

### Backend (Supabase)

#### Database: PostgreSQL 15+
```sql
-- Row Level Security (RLS) enabled
-- Automatic timestamps
-- UUID primary keys
-- Foreign key constraints
-- Indexes on frequently queried columns
```

#### Authentication
- Email/Password
- Magic Link
- OAuth Providers (Google, Facebook) - future
- Row Level Security policies
- JWT tokens

#### Storage
- Public buckets per immagini alimenti
- Private buckets per dati utente
- Automatic image optimization
- CDN delivery

#### Realtime (Future)
- WebSocket connection
- Real-time updates per liste condivise
- Presenza utenti online

### External APIs

#### Open Food Facts
```typescript
interface OpenFoodFactsConfig {
  baseURL: 'https://world.openfoodfacts.org/api/v2'
  timeout: 5000
  retries: 3
  caching: 'aggressive' // cache responses
}
```

**Endpoints usati:**
- `GET /product/{barcode}.json` - Product details
- Nessuna autenticazione richiesta
- Rate limits: nessuno (pubblico)

#### Ko-fi (Support/Donations)
```typescript
interface KofiButtonConfig {
  url: string // From VITE_KOFI_URL env variable
  imageURL: 'https://storage.ko-fi.com/cdn/kofi6.png?v=6'
  target: '_blank'
  rel: 'noopener noreferrer'
}
```

**Component**: `src/components/ui/KofiButton.tsx`

**Features:**
- Conditional rendering (hidden if `VITE_KOFI_URL` not set)
- Mobile-friendly (44px touch target, responsive sizing)
- External link with security attributes (`noopener noreferrer`)
- CDN image from Ko-fi (storage.ko-fi.com)
- Zero privacy impact (no cookies, no tracking from entro side)

**Environment Variable:**
```bash
# .env.local (not committed)
VITE_KOFI_URL=https://ko-fi.com/G2G61TCD8H

# .env.example (committed)
VITE_KOFI_URL=  # Leave empty to hide Ko-fi button (for forks)
```

**Integration:**
- Displayed at bottom of `DashboardPage` component
- Styled with Tailwind CSS
- Localized text: "Ti piace questo progetto?" (Italian)

### Build & Deploy

#### Build Tool
- **Vite** con plugin:
  - `@vitejs/plugin-react-swc` - Fast Refresh
  - `vite-plugin-pwa` - PWA support
  - `vite-tsconfig-paths` - Path aliases

#### Deployment
- **Netlify**
  - Continuous deployment da GitHub
  - Automatic HTTPS
  - Edge functions (future)
  - Preview deployments per PR

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

## 📁 Struttura Directory Dettagliata

```
food-expiry-tracker/
├── public/
│   ├── icons/              # PWA icons
│   ├── manifest.json       # PWA manifest
│   └── robots.txt
│
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── styles/
│   │       └── globals.css
│   │
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   │
│   │   ├── foods/
│   │   │   ├── FoodCard.tsx
│   │   │   ├── FoodForm.tsx
│   │   │   ├── FoodList.tsx
│   │   │   ├── SwipeableCard.tsx
│   │   │   └── FoodFilters.tsx
│   │   │
│   │   ├── barcode/
│   │   │   ├── BarcodeScanner.tsx
│   │   │   └── ScannerModal.tsx
│   │   │
│   │   ├── calendar/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   └── MonthView.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   └── common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── hooks/
│   │   ├── useFoods.ts
│   │   ├── useBarcodeScanner.ts
│   │   ├── useFilters.ts
│   │   ├── useAuth.ts
│   │   ├── useCategories.ts
│   │   └── useDebounce.ts
│   │
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── openFoodFacts.ts    # Open Food Facts API
│   │   ├── date-utils.ts       # Date helpers
│   │   ├── category-mapping.ts # Category inference
│   │   ├── image-upload.ts     # Image handling
│   │   └── constants.ts        # App constants
│   │
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── foodStore.ts
│   │   ├── uiStore.ts
│   │   └── filterStore.ts
│   │
│   ├── types/
│   │   ├── food.types.ts
│   │   ├── category.types.ts
│   │   ├── user.types.ts
│   │   └── api.types.ts
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Calendar.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
│
├── supabase/
│   ├── migrations/
│   │   ├── 20240101000000_initial_schema.sql
│   │   ├── 20240102000000_add_categories.sql
│   │   └── ...
│   ├── functions/          # Edge functions (future)
│   └── config.toml
│
├── docs/                   # Project documentation
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 🔐 Type Definitions

### Core Types

```typescript
// types/food.types.ts
export interface Food {
  id: string
  user_id: string
  name: string
  quantity: number | null
  quantity_unit: string | null
  expiry_date: string // ISO date
  category_id: string
  storage_location: StorageLocation
  image_url: string | null
  barcode: string | null
  notes: string | null
  created_at: string
  updated_at: string
  
  // Relations (joined data)
  category?: Category
}

export type StorageLocation = 'fridge' | 'freezer' | 'pantry'

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  default_storage: StorageLocation
  average_shelf_life_days: number
}

export interface FoodFilters {
  categories: string[]
  storageLocations: StorageLocation[]
  searchQuery: string
  sortBy: 'expiry_date' | 'name' | 'created_at'
  sortOrder: 'asc' | 'desc'
}

export interface FoodFormData {
  name: string
  quantity?: number
  quantity_unit?: string
  expiry_date: Date
  category_id: string
  storage_location: StorageLocation
  image?: File
  barcode?: string
  notes?: string
}
```

## 🔄 Data Flow

### Food Item Creation Flow

```
User Action → Form Validation → API Call → Database → Cache Update → UI Update

1. User fills form or scans barcode
   ↓
2. Zod validates input
   ↓
3. If barcode: Query Open Food Facts
   ↓
4. Pre-fill form with product data
   ↓
5. User confirms/modifies
   ↓
6. React Query mutation to Supabase
   ↓
7. Database INSERT with RLS check
   ↓
8. Upload image to Storage (if provided)
   ↓
9. React Query invalidates cache
   ↓
10. UI updates with new item
```

### Barcode Scanning Flow

```
1. User clicks "Scan Barcode"
   ↓
2. Request camera permission
   ↓
3. Initialize html5-qrcode scanner
   ↓
4. Continuous frame analysis
   ↓
5. Barcode detected → stop scanner
   ↓
6. Query Open Food Facts API
   ↓
7. If found: Pre-fill form
   ↓
8. If not found: Check local database
   ↓
9. If still not found: Manual entry + save for future
```

## ⚡ Performance Optimizations

### Frontend
- **Code Splitting**: Route-based chunks
- **Lazy Loading**: Components and routes
- **Image Optimization**: WebP format, lazy load
- **Virtual Scrolling**: For large food lists
- **Debounced Search**: 300ms delay
- **Memoization**: useMemo for expensive calculations
- **React Query Caching**: Stale-while-revalidate strategy

### Backend (Supabase)
- **Database Indexes**:
  ```sql
  CREATE INDEX idx_foods_user_expiry ON foods(user_id, expiry_date);
  CREATE INDEX idx_foods_category ON foods(category_id);
  CREATE INDEX idx_foods_storage ON foods(storage_location);
  ```
- **RLS Policies**: Ottimizzate per performance
- **Connection Pooling**: Automatic con Supabase

### PWA
- **Service Worker**: Cache-first strategy per assets
- **App Shell**: Pre-cache shell della app
- **Offline Support**: Fallback per dati critici

## 🔒 Security

### Authentication
- JWT tokens con scadenza
- Refresh token automatico
- Secure HTTP-only cookies
- CSRF protection

### Database Security
```sql
-- RLS Policy esempio
CREATE POLICY "Users can only see own foods"
ON foods FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert own foods"
ON foods FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
  content="default-src 'self'; 
           img-src 'self' data: https://images.openfoodfacts.org https://[supabase-project].supabase.co;
           script-src 'self' 'unsafe-inline';
           style-src 'self' 'unsafe-inline';">
```

## 📱 Progressive Web App (PWA)

### Manifest Configuration
```json
{
  "name": "entro",
  "short_name": "FoodExpiry",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#10b981",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "orientation": "portrait",
  "categories": ["productivity", "lifestyle"],
  "screenshots": [...]
}
```

### Service Worker Strategy
```typescript
// Workbox configuration
{
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 }
      }
    },
    {
      urlPattern: /^https:\/\/images\.openfoodfacts\.org\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'product-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }
      }
    }
  ]
}
```

## 🧪 Testing Strategy

### Unit Tests (Vitest)
- Utility functions
- Hooks (con @testing-library/react-hooks)
- Store logic (Zustand)

### Integration Tests (Testing Library)
- Component interactions
- Form submissions
- API mocking (MSW)

### E2E Tests (Playwright) - Future
- Critical user flows
- Cross-browser testing
- Mobile viewport testing

## 🔍 Monitoring & Analytics

### Error Tracking
- **Sentry** (opzionale)
  - Frontend error tracking
  - Performance monitoring
  - User feedback

### Analytics
- **Plausible** o **PostHog** (privacy-friendly)
  - Page views
  - Feature usage
  - User retention

### Logging
```typescript
// lib/logger.ts
export const logger = {
  info: (message: string, context?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${message}`, context)
    }
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error)
    // Send to Sentry in production
  }
}
```

## 📊 Database Schema

Vedi [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) per dettagli completi sullo schema e migrations.

---

## 🔧 Supabase RPC Functions

### delete_user() - GDPR Account Deletion

**Purpose**: Permanently delete user account and all associated data (GDPR Art. 17).

**Function Signature**:
```sql
CREATE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Security**:
- `SECURITY DEFINER` allows function to access `auth.users` table
- Only authenticated user can delete their own account (`auth.uid()` check)
- Granted to `authenticated` role, revoked from `anon`

**Deletion Order** (Critical for data integrity):
```sql
1. DELETE FROM foods WHERE user_id = current_user_id;
2. DELETE FROM invites
   WHERE created_by = current_user_id
      OR pending_user_email = user.email;  -- CRITICAL: prevents re-registration issues
3. DELETE FROM list_members WHERE user_id = current_user_id;
4. DELETE FROM lists WHERE created_by = current_user_id AND no members;
5. DELETE FROM auth.users WHERE id = current_user_id;
```

**Why Manual Cascade?**
- No foreign key constraints from `public.*` tables to `auth.users`
- Supabase doesn't support FK from public schema to auth schema
- Manual DELETE ensures complete data removal

**CRITICAL BUG FIX (1 Feb 2026)**:
```sql
-- BUG: Only deleted invites created BY user
DELETE FROM invites WHERE created_by = current_user_id;

-- FIX: Also delete invites sent TO user
DELETE FROM invites
WHERE created_by = current_user_id
   OR pending_user_email = (SELECT email FROM auth.users WHERE id = current_user_id);
```

**Bug Impact**:
- 🔴 Security: HIGH - User could re-register and auto-join old shared lists
- 🔴 GDPR: CRITICAL - Violation of "right to be forgotten" (Art. 17)
- ✅ Fix verified: Re-registration creates new personal list (isolation confirmed)

**Data Deletion Scope**:
| Data Type | Deletion Method | Notes |
|-----------|-----------------|-------|
| User profile | `DELETE FROM auth.users` | Permanent |
| Foods | `DELETE FROM foods` | All user's food items |
| Storage images | App logic (before RPC) | Via `supabase.storage.remove()` |
| Invites (created) | `DELETE FROM invites` | Where `created_by = user` |
| Invites (received) | `DELETE FROM invites` | Where `pending_user_email = email` |
| List memberships | `DELETE FROM list_members` | All memberships |
| Orphaned lists | `DELETE FROM lists` | If user was creator and only member |
| localStorage | App logic (after RPC) | `localStorage.clear()` |

**Hard Delete vs Soft Delete**:
- ✅ **Hard Delete**: Permanent removal from database
- ❌ **Soft Delete**: NOT used (GDPR requires complete erasure)
- ℹ️ **Backups**: May persist in Supabase backups for max 6 months (GDPR compliant)

**Usage in Frontend**:
```typescript
// DeleteAccountDialog.tsx
const handleDelete = async () => {
  // 1. Re-authenticate with password
  await supabase.auth.signInWithPassword({ email, password });

  // 2. Delete storage images
  await supabase.storage.from('food-images').remove(imagePaths);

  // 3. Call RPC to delete user account
  await supabase.rpc('delete_user');

  // 4. Clear local data
  localStorage.clear();
  sessionStorage.clear();

  // 5. Logout + redirect
  await signOut();
  navigate('/login');
};
```

---

## 🚀 Deployment Pipeline

```
Git Push → GitHub Actions → Build → Test → Deploy → Notify

1. Developer pushes to branch
   ↓
2. GitHub Action triggers
   ↓
3. npm install & build
   ↓
4. Run tests
   ↓
5. If main branch: Deploy to production (Netlify)
   ↓
6. If PR: Deploy preview environment
   ↓
7. Notify on Slack/Discord (opzionale)
```

### Environment Variables

```bash
# .env.example
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=https://yourapp.netlify.app
VITE_ENABLE_ANALYTICS=true
```

---

**Next**: Vedi [FEATURES.md](FEATURES.md) per dettagli sulle funzionalità specifiche.
