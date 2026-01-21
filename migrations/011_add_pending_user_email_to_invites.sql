-- Migration: Add pending_user_email to track signup before email confirmation
-- This allows accepting invites after email confirmation even from different device/tab

-- Add pending_user_email column
ALTER TABLE invites ADD COLUMN IF NOT EXISTS pending_user_email VARCHAR(255);

-- Add index for fast lookup by pending email
CREATE INDEX IF NOT EXISTS idx_invites_pending_user_email ON invites(pending_user_email) WHERE pending_user_email IS NOT NULL;

-- Add comment
COMMENT ON COLUMN invites.pending_user_email IS 'Email of user who signed up with this invite but has not yet confirmed email';
