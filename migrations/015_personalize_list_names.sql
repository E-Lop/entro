-- Migration: Personalize List Names with User Info
-- Description: Updates list names to include user display name or email for better debugging
-- Date: 2026-01-27
-- Purpose: Make logs clearer during invite acceptance and shared list flows

-- =============================================================================
-- STEP 1: Update existing lists with personalized names
-- =============================================================================

-- Update all existing lists to use user's display name or email
UPDATE lists l
SET name = CONCAT('Lista di ', COALESCE(
  (SELECT u.raw_user_meta_data->>'full_name'
   FROM auth.users u
   WHERE u.id = l.created_by),
  (SELECT u.email
   FROM auth.users u
   WHERE u.id = l.created_by)
))
WHERE l.name = 'La mia lista'
  AND l.created_by IS NOT NULL;

-- =============================================================================
-- STEP 2: Update the trigger function to use personalized names
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_list_for_user()
RETURNS TRIGGER AS $$
DECLARE
  new_list_id UUID;
  pending_invite_count INTEGER;
  list_name TEXT;
BEGIN
  -- Check if user has a pending invite
  SELECT COUNT(*) INTO pending_invite_count
  FROM invites
  WHERE email = NEW.email
    AND status = 'pending'
    AND expires_at > NOW();

  -- Only create list if user has NO pending invites
  IF pending_invite_count = 0 THEN
    -- Generate personalized list name using full_name or email
    list_name := CONCAT('Lista di ', COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.email
    ));

    -- Create new list for the user
    INSERT INTO lists (created_by, name)
    VALUES (NEW.id, list_name)
    RETURNING id INTO new_list_id;

    -- Add user as member of their own list
    INSERT INTO list_members (list_id, user_id)
    VALUES (new_list_id, NEW.id);

    RAISE NOTICE 'Created default list % with name "%" for user %', new_list_id, list_name, NEW.id;
  ELSE
    RAISE NOTICE 'User % has pending invite, skipping default list creation', NEW.email;
  END IF;

  -- If user has pending invite, acceptInvite() Edge Function will handle list membership

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 3: Update the RPC function to use personalized names
-- =============================================================================

CREATE OR REPLACE FUNCTION create_personal_list()
RETURNS TABLE (
  list_id UUID,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_existing_list_id UUID;
  v_new_list_id UUID;
  v_list_name TEXT;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      'User not authenticated'::TEXT;
    RETURN;
  END IF;

  -- Check if user already has a list
  SELECT lm.list_id INTO v_existing_list_id
  FROM list_members lm
  WHERE lm.user_id = v_user_id
  LIMIT 1;

  -- If user already has a list, return it (idempotent)
  IF v_existing_list_id IS NOT NULL THEN
    RETURN QUERY SELECT
      v_existing_list_id,
      TRUE,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Generate personalized list name using full_name or email
  SELECT CONCAT('Lista di ', COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.email
  ))
  INTO v_list_name
  FROM auth.users u
  WHERE u.id = v_user_id;

  -- Create new list
  INSERT INTO lists (name, created_by)
  VALUES (v_list_name, v_user_id)
  RETURNING id INTO v_new_list_id;

  -- Add user as member
  INSERT INTO list_members (list_id, user_id)
  VALUES (v_new_list_id, v_user_id);

  -- Return success
  RETURN QUERY SELECT
    v_new_list_id,
    TRUE,
    NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error
    RETURN QUERY SELECT
      NULL::UUID,
      FALSE,
      SQLERRM::TEXT;
END;
$$;

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
--
-- This migration personalizes list names to improve debugging:
--
-- STEP 1 - Backfill existing lists:
-- - Updates all existing lists named "La mia lista"
-- - Uses user's full_name from metadata if available, otherwise email
-- - Format: "Lista di [full_name]" or "Lista di [email]"
--
-- STEP 2 - Update trigger function:
-- - Modified to generate personalized names for new signups
-- - Uses NEW.raw_user_meta_data->>'full_name' or NEW.email
-- - Makes logs clearer during user registration flow
--
-- STEP 3 - Update RPC function:
-- - Modified to generate personalized names when called from TypeScript
-- - Queries auth.users to get user metadata
-- - Used during invite acceptance when creating personal lists
--
-- BENEFITS FOR DEBUGGING:
-- - Console logs now show "Lista di Mario Rossi" instead of "La mia lista"
-- - Easier to track which user's list is being operated on
-- - Clearer visibility during invite acceptance and list leaving flows
-- - No ambiguity when multiple users are being tested
