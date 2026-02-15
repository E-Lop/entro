-- ============================================
-- Supabase Storage Configuration for Food Images
-- ============================================
-- Execute this SQL in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query

-- Create storage bucket for food images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-images',
  'food-images',
  false, -- private bucket, only accessible by authenticated users
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage RLS Policies
-- ============================================

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload own food images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own images
CREATE POLICY "Users can view own food images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own images
CREATE POLICY "Users can update own food images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete own food images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'food-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- Verification Queries
-- ============================================
-- Run these to verify setup:

-- Check bucket exists
-- SELECT * FROM storage.buckets WHERE id = 'food-images';

-- Check policies
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%food images%';
