-- Migration: Add list_id to foods table
-- Description: Adds list_id column to support shared lists (backward compatible)
-- Date: 2026-01-19

-- =============================================================================
-- ALTER TABLE: foods (Add list_id column)
-- =============================================================================

-- Add list_id column (nullable for backward compatibility)
ALTER TABLE foods
ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_foods_list_id ON foods(list_id) WHERE list_id IS NOT NULL;

-- Composite index for common query pattern (list + expiry date)
CREATE INDEX IF NOT EXISTS idx_foods_list_expiry ON foods(list_id, expiry_date)
  WHERE deleted_at IS NULL AND list_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN foods.list_id IS 'NULL = personal food (legacy), UUID = shared list food';

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- list_id = NULL  → Personal food (legacy users, backward compatible)
-- list_id = UUID  → Shared list food (new feature)
-- user_id remains to track who created the food item
