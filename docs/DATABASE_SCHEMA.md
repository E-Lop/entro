# Database Schema

## 🗄️ Overview

Database: **PostgreSQL 15+** (via Supabase)
- Row Level Security (RLS) abilitato
- UUID per primary keys
- Automatic timestamps
- Foreign key constraints
- Indexes ottimizzati

## 📊 Entity Relationship Diagram

```
┌─────────────────┐
│     users       │ (Managed by Supabase Auth)
│─────────────────│
│ id (UUID)       │──┐
│ email           │  │
│ created_at      │  │
└─────────────────┘  │
                     │
                     │ 1:N
                     │
         ┌───────────┴──────────┐
         │                      │
         ↓                      │
┌─────────────────┐             │
│     foods       │             │
│─────────────────│             │
│ id (UUID)       │             │
│ user_id (FK)    │─────────────┘
│ name            │
│ quantity        │
│ quantity_unit   │
│ expiry_date     │
│ category_id (FK)│──┐
│ storage_location│  │
│ image_url       │  │
│ barcode         │  │
│ notes           │  │
│ created_at      │  │
│ updated_at      │  │
│ deleted_at      │  │  N:1
└─────────────────┘  │
                     │
                     ↓
           ┌─────────────────┐
           │   categories    │
           │─────────────────│
           │ id (UUID)       │
           │ name            │
           │ icon            │
           │ color           │
           │ default_storage │
           │ avg_shelf_life  │
           └─────────────────┘

┌──────────────────────┐
│   shared_lists       │ (Future)
│──────────────────────│
│ id (UUID)            │
│ owner_id (FK)        │
│ shared_with_id (FK)  │
│ permissions          │
│ created_at           │
└──────────────────────┘
```

## 📝 Table Definitions

### Table: `categories`

Categorie predefinite per classificare gli alimenti.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_it TEXT NOT NULL,
  icon TEXT NOT NULL, -- Lucide icon name
  color TEXT NOT NULL, -- Hex color
  default_storage TEXT NOT NULL CHECK (default_storage IN ('fridge', 'freezer', 'pantry')),
  average_shelf_life_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sample data
INSERT INTO categories (name, name_it, icon, color, default_storage, average_shelf_life_days) VALUES
  ('dairy', 'Latticini', 'milk', '#3B82F6', 'fridge', 7),
  ('meat', 'Carne', 'beef', '#EF4444', 'fridge', 3),
  ('fish', 'Pesce', 'fish', '#06B6D4', 'fridge', 2),
  ('fruits', 'Frutta', 'apple', '#F59E0B', 'fridge', 5),
  ('vegetables', 'Verdura', 'carrot', '#10B981', 'fridge', 7),
  ('bakery', 'Pane e Pasta', 'wheat', '#D97706', 'pantry', 3),
  ('beverages', 'Bevande', 'cup-soda', '#8B5CF6', 'pantry', 180),
  ('frozen', 'Surgelati', 'snowflake', '#0EA5E9', 'freezer', 90),
  ('condiments', 'Condimenti', 'soup', '#F97316', 'pantry', 365),
  ('snacks', 'Snack', 'candy', '#EC4899', 'pantry', 30),
  ('other', 'Altro', 'package', '#6B7280', 'pantry', 7);
```

### Table: `foods`

Alimenti dell'utente con tracking scadenze.

```sql
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Product info
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  quantity_unit TEXT CHECK (quantity_unit IN ('pz', 'kg', 'g', 'l', 'ml', 'confezioni')),
  
  -- Expiry tracking
  expiry_date DATE NOT NULL,
  
  -- Classification
  category_id UUID NOT NULL REFERENCES categories(id),
  storage_location TEXT NOT NULL CHECK (storage_location IN ('fridge', 'freezer', 'pantry')),
  
  -- Media & metadata
  image_url TEXT,
  barcode TEXT,
  notes TEXT,
  
  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'wasted')),
  consumed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Indexes for performance
CREATE INDEX idx_foods_user_id ON foods(user_id);
CREATE INDEX idx_foods_expiry_date ON foods(expiry_date);
CREATE INDEX idx_foods_user_expiry ON foods(user_id, expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_foods_category ON foods(category_id);
CREATE INDEX idx_foods_storage ON foods(storage_location);
CREATE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_status ON foods(status);

-- Full-text search index (Italian)
CREATE INDEX idx_foods_name_search ON foods USING gin(to_tsvector('italian', name));
```

### Table: `product_templates` (Local Database)

Template di prodotti per accelerare inserimenti futuri.

```sql
CREATE TABLE product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product identification
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  
  -- Auto-fill data
  category_id UUID REFERENCES categories(id),
  default_storage TEXT CHECK (default_storage IN ('fridge', 'freezer', 'pantry')),
  average_shelf_life_days INTEGER,
  
  -- Open Food Facts data
  image_url TEXT,
  nutriscore_grade TEXT,
  
  -- Crowdsourced improvements
  user_contributions INTEGER DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_product_templates_barcode ON product_templates(barcode);
CREATE INDEX idx_product_templates_name ON product_templates USING gin(to_tsvector('italian', name));
```

### Table: `shared_lists` (Future Feature)

Condivisione liste tra utenti.

```sql
CREATE TABLE shared_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  permissions TEXT NOT NULL CHECK (permissions IN ('read', 'write')) DEFAULT 'read',
  
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(owner_id, shared_with_user_id)
);

CREATE INDEX idx_shared_lists_owner ON shared_lists(owner_id);
CREATE INDEX idx_shared_lists_shared_with ON shared_lists(shared_with_user_id);
```

### Table: `notifications_preferences`

Preferenze notifiche per ogni utente.

```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification settings
  enabled BOOLEAN DEFAULT true,
  days_before_expiry INTEGER DEFAULT 3 CHECK (days_before_expiry >= 0),
  notification_time TIME DEFAULT '18:00:00',
  weekly_digest BOOLEAN DEFAULT false,
  weekly_digest_day TEXT DEFAULT 'sunday' CHECK (weekly_digest_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  
  -- Push notification subscription
  push_subscription JSONB,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔐 Row Level Security (RLS) Policies

### Foods Table Policies

```sql
-- Enable RLS
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

-- Users can view only their own foods
CREATE POLICY "Users can view own foods"
  ON foods
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert only their own foods
CREATE POLICY "Users can insert own foods"
  ON foods
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update only their own foods
CREATE POLICY "Users can update own foods"
  ON foods
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own foods (soft delete)
CREATE POLICY "Users can delete own foods"
  ON foods
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can view foods in shared lists (Future)
CREATE POLICY "Users can view shared foods"
  ON foods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_lists
      WHERE shared_lists.owner_id = foods.user_id
        AND shared_lists.shared_with_user_id = auth.uid()
        AND shared_lists.accepted_at IS NOT NULL
    )
  );

-- Users can modify foods in shared lists with write permission (Future)
CREATE POLICY "Users can modify shared foods"
  ON foods
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shared_lists
      WHERE shared_lists.owner_id = foods.user_id
        AND shared_lists.shared_with_user_id = auth.uid()
        AND shared_lists.permissions = 'write'
        AND shared_lists.accepted_at IS NOT NULL
    )
  );
```

### Categories Table Policies

```sql
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories are public (read-only)
CREATE POLICY "Categories are publicly readable"
  ON categories
  FOR SELECT
  TO authenticated
  USING (true);
```

### Product Templates Policies

```sql
ALTER TABLE product_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can read templates
CREATE POLICY "Product templates are publicly readable"
  ON product_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can contribute templates
CREATE POLICY "Authenticated users can insert templates"
  ON product_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

## ⚙️ Database Functions

### Function: Update Timestamp

```sql
-- Automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to foods table
CREATE TRIGGER update_foods_updated_at
  BEFORE UPDATE ON foods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Function: Soft Delete

```sql
-- Soft delete instead of hard delete
CREATE OR REPLACE FUNCTION soft_delete_food()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE foods
  SET deleted_at = NOW(),
      status = CASE 
        WHEN OLD.status = 'active' THEN 'wasted'
        ELSE OLD.status
      END
  WHERE id = OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (optional, depends on preference)
-- CREATE TRIGGER before_food_delete
--   BEFORE DELETE ON foods
--   FOR EACH ROW
--   EXECUTE FUNCTION soft_delete_food();
```

### Function: Get Expiring Foods

```sql
-- Get foods expiring within N days
CREATE OR REPLACE FUNCTION get_expiring_foods(
  p_user_id UUID,
  p_days_until_expiry INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  expiry_date DATE,
  days_until_expiry INTEGER,
  category_name TEXT,
  storage_location TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.expiry_date,
    (f.expiry_date - CURRENT_DATE)::INTEGER AS days_until_expiry,
    c.name_it AS category_name,
    f.storage_location
  FROM foods f
  JOIN categories c ON f.category_id = c.id
  WHERE f.user_id = p_user_id
    AND f.status = 'active'
    AND f.deleted_at IS NULL
    AND f.expiry_date <= CURRENT_DATE + p_days_until_expiry
  ORDER BY f.expiry_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Update Product Template Stats

```sql
-- Update product template with new user contribution
CREATE OR REPLACE FUNCTION update_product_template_stats(
  p_barcode TEXT,
  p_name TEXT,
  p_category_id UUID,
  p_storage TEXT,
  p_shelf_life_days INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Check if template exists
  SELECT * INTO v_existing
  FROM product_templates
  WHERE barcode = p_barcode;
  
  IF FOUND THEN
    -- Update with weighted average
    UPDATE product_templates
    SET 
      average_shelf_life_days = (
        (average_shelf_life_days * user_contributions + p_shelf_life_days) / 
        (user_contributions + 1)
      )::INTEGER,
      user_contributions = user_contributions + 1,
      last_updated = NOW()
    WHERE barcode = p_barcode;
  ELSE
    -- Insert new template
    INSERT INTO product_templates (
      barcode, name, category_id, default_storage, average_shelf_life_days
    ) VALUES (
      p_barcode, p_name, p_category_id, p_storage, p_shelf_life_days
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📊 Useful Views

### View: Foods with Days Until Expiry

```sql
CREATE OR REPLACE VIEW foods_with_expiry_status AS
SELECT 
  f.*,
  c.name_it AS category_name,
  c.icon AS category_icon,
  c.color AS category_color,
  (f.expiry_date - CURRENT_DATE)::INTEGER AS days_until_expiry,
  CASE 
    WHEN f.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN f.expiry_date = CURRENT_DATE THEN 'expires_today'
    WHEN f.expiry_date <= CURRENT_DATE + 2 THEN 'expires_soon'
    WHEN f.expiry_date <= CURRENT_DATE + 7 THEN 'expires_this_week'
    ELSE 'fresh'
  END AS expiry_status
FROM foods f
JOIN categories c ON f.category_id = c.id
WHERE f.deleted_at IS NULL;
```

## 🚀 Migrations

### Initial Setup Migration

Create file: `supabase/migrations/20240101000000_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  name_it TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  default_storage TEXT NOT NULL CHECK (default_storage IN ('fridge', 'freezer', 'pantry')),
  average_shelf_life_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, name_it, icon, color, default_storage, average_shelf_life_days) VALUES
  ('dairy', 'Latticini', 'milk', '#3B82F6', 'fridge', 7),
  ('meat', 'Carne', 'beef', '#EF4444', 'fridge', 3),
  ('fish', 'Pesce', 'fish', '#06B6D4', 'fridge', 2),
  ('fruits', 'Frutta', 'apple', '#F59E0B', 'fridge', 5),
  ('vegetables', 'Verdura', 'carrot', '#10B981', 'fridge', 7),
  ('bakery', 'Pane e Pasta', 'wheat', '#D97706', 'pantry', 3),
  ('beverages', 'Bevande', 'cup-soda', '#8B5CF6', 'pantry', 180),
  ('frozen', 'Surgelati', 'snowflake', '#0EA5E9', 'freezer', 90),
  ('condiments', 'Condimenti', 'soup', '#F97316', 'pantry', 365),
  ('snacks', 'Snack', 'candy', '#EC4899', 'pantry', 30),
  ('other', 'Altro', 'package', '#6B7280', 'pantry', 7);

-- Foods table
CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  quantity_unit TEXT CHECK (quantity_unit IN ('pz', 'kg', 'g', 'l', 'ml', 'confezioni')),
  expiry_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  storage_location TEXT NOT NULL CHECK (storage_location IN ('fridge', 'freezer', 'pantry')),
  image_url TEXT,
  barcode TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'wasted')),
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT positive_quantity CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX idx_foods_user_id ON foods(user_id);
CREATE INDEX idx_foods_expiry_date ON foods(expiry_date);
CREATE INDEX idx_foods_user_expiry ON foods(user_id, expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_foods_category ON foods(category_id);
CREATE INDEX idx_foods_storage ON foods(storage_location);
CREATE INDEX idx_foods_barcode ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_status ON foods(status);
CREATE INDEX idx_foods_name_search ON foods USING gin(to_tsvector('italian', name));

-- RLS Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are publicly readable"
  ON categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own foods"
  ON foods FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own foods"
  ON foods FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own foods"
  ON foods FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own foods"
  ON foods FOR DELETE USING (auth.uid() = user_id);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_foods_updated_at
  BEFORE UPDATE ON foods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## 💾 Backup & Restore

```bash
# Backup (via Supabase CLI)
supabase db dump -f backup.sql

# Restore
supabase db reset
psql -h db.project.supabase.co -U postgres -f backup.sql
```

## 📈 Performance Monitoring

```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Next**: Vedi [ROADMAP.md](ROADMAP.md) per il piano di sviluppo dettagliato.
