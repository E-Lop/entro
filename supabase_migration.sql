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
