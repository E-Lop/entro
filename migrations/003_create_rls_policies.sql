-- Migration: RLS Policies for Shared Lists
-- Description: Row Level Security policies for lists, list_members, invites, and updated policies for foods
-- Date: 2026-01-19

-- =============================================================================
-- RLS POLICIES: lists table
-- =============================================================================

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- Users can view lists they belong to
CREATE POLICY "Users can view lists they belong to"
  ON lists FOR SELECT
  USING (
    id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Users can create their own lists
CREATE POLICY "Users can create their own lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- List members can update list details
CREATE POLICY "List members can update list details"
  ON lists FOR UPDATE
  USING (
    id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- =============================================================================
-- RLS POLICIES: list_members table
-- =============================================================================

ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- Members can view other members of their lists
CREATE POLICY "Users can view members of their lists"
  ON list_members FOR SELECT
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Users can add themselves to a list (via invite acceptance)
CREATE POLICY "Users can add themselves to a list via invite"
  ON list_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- RLS POLICIES: invites table
-- =============================================================================

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Members can view invites for their lists
CREATE POLICY "Users can view invites for their lists"
  ON invites FOR SELECT
  USING (
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- List members can create invites
CREATE POLICY "List members can create invites"
  ON invites FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- Anyone can validate invite tokens (for signup flow)
CREATE POLICY "Anyone can validate invite tokens"
  ON invites FOR SELECT
  USING (true);

-- System can update invite status (accept/expire)
CREATE POLICY "System can update invite status"
  ON invites FOR UPDATE
  USING (true);

-- =============================================================================
-- RLS POLICIES: foods table (UPDATED FOR SHARED LISTS)
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own foods" ON foods;
DROP POLICY IF EXISTS "Users can insert own foods" ON foods;
DROP POLICY IF EXISTS "Users can update own foods" ON foods;
DROP POLICY IF EXISTS "Users can delete own foods" ON foods;

-- New policies: support both personal and shared foods

-- SELECT: Own foods OR shared list foods
CREATE POLICY "Users can view own foods or shared list foods"
  ON foods FOR SELECT
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- INSERT: Create personal foods OR foods in shared lists
CREATE POLICY "Users can insert foods to own account or shared lists"
  ON foods FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id AND list_id IS NULL) OR
    (list_id IS NOT NULL AND list_id IN (
      SELECT list_id FROM list_members WHERE user_id = auth.uid()
    ))
  );

-- UPDATE: Modify own foods OR shared list foods
CREATE POLICY "Users can update own foods or shared list foods"
  ON foods FOR UPDATE
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );

-- DELETE: Remove own foods OR shared list foods
CREATE POLICY "Users can delete own foods or shared list foods"
  ON foods FOR DELETE
  USING (
    auth.uid() = user_id OR
    list_id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
  );
