-- Migration: Add DELETE policy for list_members table
-- Description: Allow users to remove themselves from lists (leave list feature)
-- Date: 2026-01-27
-- Fixes: Bug where users cannot leave shared lists due to missing DELETE policy

-- =============================================================================
-- RLS POLICY: list_members DELETE
-- =============================================================================

-- Users can remove themselves from any list they're a member of
CREATE POLICY "Users can remove themselves from lists"
  ON list_members FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- This policy allows users to delete their own membership records from any list.
-- This is required for the "leave list" feature where users abandon shared lists.
--
-- Security: Users can only delete rows where user_id matches their auth.uid(),
-- preventing them from removing other users from lists.
