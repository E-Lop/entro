-- Migration: Fix RLS Policies for list_members and invites tables
-- Description: Remove self-referential subqueries causing infinite recursion
-- Date: 2026-01-19

-- =============================================================================
-- FIX list_members TABLE POLICIES
-- =============================================================================

-- Drop and recreate policy for list_members SELECT
DROP POLICY IF EXISTS "Users can view members of their lists" ON list_members;

CREATE POLICY "Users can view members of their lists"
  ON list_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    list_id IN (SELECT get_user_list_ids())
  );

-- =============================================================================
-- FIX invites TABLE POLICIES
-- =============================================================================

-- Drop and recreate policies that reference list_members
DROP POLICY IF EXISTS "Users can view invites for their lists" ON invites;
DROP POLICY IF EXISTS "List members can create invites" ON invites;

-- Members can view invites for their lists
CREATE POLICY "Users can view invites for their lists"
  ON invites FOR SELECT
  USING (
    list_id IN (SELECT get_user_list_ids())
  );

-- List members can create invites
CREATE POLICY "List members can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    list_id IN (SELECT get_user_list_ids())
  );

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- The list_members policy now allows users to see:
--   1. Their own membership records (user_id = auth.uid())
--   2. Other members in their lists (using get_user_list_ids())
--
-- The invites policies now use get_user_list_ids() instead of inline subqueries,
-- preventing infinite recursion when querying list_members.
