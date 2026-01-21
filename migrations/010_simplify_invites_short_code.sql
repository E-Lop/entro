-- Migration: Simplify invites with short codes
-- Add short_code as primary identifier for invites
-- Remove email requirement for anonymous invite sharing

-- Add short_code column (nullable initially for safe rollout)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS short_code VARCHAR(8);

-- Create unique index for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_short_code ON invites(short_code);

-- Make email nullable (backwards compatibility)
ALTER TABLE invites ALTER COLUMN email DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN invites.short_code IS 'Short 6-character alphanumeric code for easy sharing (e.g., ABC123)';
COMMENT ON COLUMN invites.email IS 'Email is now optional - invites can be anonymous and shared with anyone';
