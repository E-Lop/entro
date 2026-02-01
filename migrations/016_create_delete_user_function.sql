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

  -- IMPORTANT: Since there are no foreign key constraints from public tables to auth.users,
  -- we must manually delete all user data before deleting the auth account.

  -- 1. Delete all foods owned by the user
  -- This will also cascade delete to related storage images via app logic
  DELETE FROM public.foods WHERE user_id = current_user_id;

  -- 2. Delete all invites created by the user
  DELETE FROM public.invites WHERE created_by = current_user_id;

  -- 3. Delete user's memberships in lists
  -- This will cascade delete to lists if user is the only member (handled by trigger)
  DELETE FROM public.list_members WHERE user_id = current_user_id;

  -- 4. Delete any orphaned lists where user was the creator
  -- Lists without members should have been deleted by the trigger above
  DELETE FROM public.lists
  WHERE created_by = current_user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.list_members WHERE list_id = lists.id
  );

  -- 5. Finally, delete user from auth.users
  DELETE FROM auth.users WHERE id = current_user_id;

  -- Log for debugging (optional, remove in production if not needed)
  RAISE NOTICE 'User % and all related data deleted successfully', current_user_id;
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
