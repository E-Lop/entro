-- Migration: Update Storage Policies for Shared Lists
-- Description: Storage policies to allow shared access to food images
-- Date: 2026-01-19

-- =============================================================================
-- STORAGE POLICIES: food-images bucket (UPDATED FOR SHARED LISTS)
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload own food images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own food images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own food images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own food images" ON storage.objects;

-- New policies: Allow access to images from users in the same shared list
-- Storage path remains: {user_id}/{filename}
-- But now, list members can access each other's images

-- INSERT: Upload to own folder OR to folders of users in same list
CREATE POLICY "Users can upload images to own folder or shared list folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
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
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
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
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
)
WITH CHECK (
  bucket_id = 'food-images' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (storage.foldername(name))[1] IN (
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
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
      SELECT created_by::text FROM lists
      WHERE id IN (SELECT list_id FROM list_members WHERE user_id = auth.uid())
    )
  )
);

-- =============================================================================
-- LOGIC EXPLANATION:
-- =============================================================================
-- Images are stored as: {user_id}/{filename}
-- List members can access images from all other members in the same list
-- This allows User B to see images uploaded by User A if they share a list
