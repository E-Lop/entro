-- Migration: Fix Storage Policies to Avoid Infinite Recursion
-- Description: Create SECURITY DEFINER function and update storage policies
-- Date: 2026-01-19

-- =============================================================================
-- HELPER FUNCTION: Get user IDs of all members in shared lists
-- =============================================================================

CREATE OR REPLACE FUNCTION get_shared_list_member_ids()
RETURNS TABLE (user_id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT lm.user_id
  FROM list_members lm
  WHERE lm.list_id IN (
    SELECT list_id
    FROM list_members
    WHERE user_id = auth.uid()
  );
$$;

-- =============================================================================
-- DROP EXISTING STORAGE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can upload images to own folder or shared list folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own images or shared list images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images or shared list images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images or shared list images" ON storage.objects;

-- =============================================================================
-- RECREATE STORAGE POLICIES USING HELPER FUNCTION
-- =============================================================================

-- INSERT: Upload to own folder OR to folders of users in same list
CREATE POLICY "Users can upload images to own folder or shared list folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM get_shared_list_member_ids()
    )
  )
);

-- SELECT: View own images OR images from users in same list
CREATE POLICY "Users can view own images or shared list images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM get_shared_list_member_ids()
    )
  )
);

-- UPDATE: Update own images OR images from users in same list
CREATE POLICY "Users can update own images or shared list images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM get_shared_list_member_ids()
    )
  )
)
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM get_shared_list_member_ids()
    )
  )
);

-- DELETE: Delete own images OR images from users in same list
CREATE POLICY "Users can delete own images or shared list images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT user_id::text FROM get_shared_list_member_ids()
    )
  )
);

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- The get_shared_list_member_ids() function uses SECURITY DEFINER to bypass RLS
-- when querying list_members, preventing infinite recursion.
--
-- Storage policies now use this function instead of inline subqueries.
-- This allows users to access images from all members in their shared lists
-- without triggering RLS recursion errors.
