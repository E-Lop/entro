-- Migration: Fix Foods RLS Policies for Single List Model
-- Description: Remove user_id-based access from foods SELECT policy to prevent users from seeing foods from old lists
-- Date: 2026-01-27
-- Issue: Users can see foods they created even after switching lists, causing stale data to appear

-- =============================================================================
-- Problem:
-- The current SELECT policy allows users to see foods if:
-- 1. auth.uid() = user_id (user created the food) OR
-- 2. list_id IN (their current lists)
--
-- This is wrong because when a user switches from List A to List B:
-- - They can still see foods from List A because they created them (user_id match)
-- - Even if List A is deleted, the foods remain visible due to user_id check
--
-- Solution:
-- Remove the user_id check and ONLY allow access based on list_id.
-- Users should only see foods from lists they are currently members of.
-- =============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own foods or shared list foods" ON foods;

-- Create new stricter SELECT policy: ONLY list-based access
CREATE POLICY "Users can view foods from their lists"
  ON foods FOR SELECT
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Update INSERT policy to match new model
-- =============================================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert foods to own account or shared lists" ON foods;

-- Create new INSERT policy: foods must belong to a list
CREATE POLICY "Users can insert foods to their lists"
  ON foods FOR INSERT
  WITH CHECK (
    list_id IS NOT NULL AND
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Update UPDATE policy to match new model
-- =============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own foods or shared list foods" ON foods;

-- Create new UPDATE policy: only foods from current lists
CREATE POLICY "Users can update foods from their lists"
  ON foods FOR UPDATE
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Update DELETE policy to match new model
-- =============================================================================

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can delete own foods or shared list foods" ON foods;

-- Create new DELETE policy: only foods from current lists
CREATE POLICY "Users can delete foods from their lists"
  ON foods FOR DELETE
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON POLICY "Users can view foods from their lists" ON foods IS
  'Users can only view foods from lists they are currently members of. Removed user_id check to prevent stale data visibility.';

COMMENT ON POLICY "Users can insert foods to their lists" ON foods IS
  'Users can only create foods in lists they are members of. list_id is now required (no NULL foods).';

COMMENT ON POLICY "Users can update foods from their lists" ON foods IS
  'Users can only update foods from their current lists.';

COMMENT ON POLICY "Users can delete foods from their lists" ON foods IS
  'Users can only delete foods from their current lists.';
