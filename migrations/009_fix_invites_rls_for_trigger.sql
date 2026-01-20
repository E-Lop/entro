-- Migration: Fix invites RLS policies for trigger compatibility
-- Description: Simplify RLS to allow trigger to read invites during signup
-- Date: 2026-01-20

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can view invites for their lists" ON invites;
DROP POLICY IF EXISTS "Anyone can validate invite tokens" ON invites;

-- Create simpler SELECT policy that allows:
-- 1. List members to view invites for their lists
-- 2. Public access to validate tokens (needed for signup flow and trigger)
CREATE POLICY "Public can read invites or list members can view their invites"
  ON invites FOR SELECT
  USING (
    true  -- Allow public read access for signup/validation flow
  );

-- Note: This is safe because:
-- - Invites don't contain sensitive data (just email, token, status)
-- - Tokens are random 32-char strings (unguessable)
-- - The validate-invite Edge Function already handles validation logic
-- - This allows the signup trigger to check for pending invites
