-- Migration: Create Helper Functions for RLS and List Management
-- Description: Creates PostgreSQL functions to avoid race conditions and RLS recursion
-- Date: 2026-01-26
-- Fixes: Missing functions referenced in code and migration 008

-- =============================================================================
-- FUNCTION 1: get_user_list_ids()
-- Used by: Migration 008 RLS policies
-- Purpose: Get list IDs that the current user belongs to (avoids RLS recursion)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_list_ids()
RETURNS TABLE (list_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT lm.list_id
  FROM list_members lm
  WHERE lm.user_id = auth.uid();
$$;

-- =============================================================================
-- FUNCTION 2: create_personal_list()
-- Used by: src/lib/invites.ts createPersonalList()
-- Purpose: Create a personal list for new users (avoids RLS race conditions)
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

  -- Create new list
  INSERT INTO lists (name, created_by)
  VALUES ('La mia lista', v_user_id)
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
-- get_user_list_ids():
-- - Uses SECURITY DEFINER to bypass RLS when querying list_members
-- - Prevents infinite recursion in RLS policies (e.g., migration 008)
-- - Returns all list IDs that the current authenticated user is a member of
--
-- create_personal_list():
-- - Uses SECURITY DEFINER to bypass client-side JWT timing issues
-- - Runs server-side with reliable access to auth.uid()
-- - Idempotent: returns existing list if user already has one
-- - Eliminates race conditions during email confirmation flow
-- - Returns structured result with list_id, success flag, and error message
