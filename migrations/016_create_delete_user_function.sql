-- Migration: Create delete_user RPC function
-- Purpose: Allow users to delete their own account (GDPR Article 17 - Right to Erasure)
--
-- This function:
-- 1. Deletes the user from auth.users
-- 2. Triggers cascade deletes via foreign keys and RLS policies:
--    - foods (where user_id = deleted user)
--    - list_members (where user_id = deleted user)
--    - invites (where created_by = deleted user)
--    - lists (if user is creator and only member)
--
-- Security: SECURITY DEFINER allows function to access auth schema
-- Only the authenticated user can delete their own account (auth.uid() check)

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();

  -- Verify user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user from auth.users
  -- This will cascade delete to related tables via foreign keys
  DELETE FROM auth.users WHERE id = current_user_id;

  -- Note: The following are handled automatically:
  -- - foods: ON DELETE CASCADE via user_id foreign key
  -- - list_members: ON DELETE CASCADE via user_id foreign key
  -- - invites: ON DELETE CASCADE via created_by foreign key
  -- - lists: Handled by trigger if user is last member

  -- Log for debugging (optional, remove in production if not needed)
  RAISE NOTICE 'User % deleted successfully', current_user_id;
END;
$$;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;

-- Revoke from anonymous users
REVOKE EXECUTE ON FUNCTION public.delete_user() FROM anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.delete_user() IS
'Allows authenticated users to delete their own account.
GDPR Article 17 - Right to Erasure compliance.
Cascade deletes all user data via foreign keys and RLS policies.';
