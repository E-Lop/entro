import { supabase } from './supabase'
import imageCompression from 'browser-image-compression'

/**
 * Storage service for uploading and managing food images
 */

const BUCKET_NAME = 'food-images'
const MAX_FILE_SIZE_MB = 5
const COMPRESSED_MAX_SIZE_MB = 1

/**
 * Extract storage path from URL or return path as is
 * Handles both storage paths and full URLs for backward compatibility
 */
function extractPathFromUrlOrPath(urlOrPath: string): string {
  // If it's already a path (doesn't start with http), return as is
  if (!urlOrPath.startsWith('http')) {
    return urlOrPath
  }

  // Extract path from URL
  // URL format: https://[project].supabase.co/storage/v1/object/public/food-images/{path}
  // or signed: https://[project].supabase.co/storage/v1/object/sign/food-images/{path}?token=...
  const parts = urlOrPath.split('/food-images/')
  if (parts.length === 2) {
    // Remove query params if present (for signed URLs)
    return parts[1].split('?')[0]
  }

  // If we can't parse it, return as is and let error handling deal with it
  return urlOrPath
}

/**
 * Compress image before upload
 */
async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: COMPRESSED_MAX_SIZE_MB,
    maxWidthOrHeight: 800, // Resize to max 800px on longest side
    useWebWorker: true,
    fileType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    throw new Error('Errore durante la compressione dell\'immagine')
  }
}

/**
 * Upload image to Supabase Storage
 * @param file - Image file to upload
 * @param userId - User ID (for folder path)
 * @returns Storage path of uploaded image (for private bucket)
 */
export async function uploadFoodImage(file: File, userId: string): Promise<string> {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Tipo di file non valido. Usa JPG, PNG o WebP.')
  }

  // Validate file size (before compression)
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File troppo grande. Massimo ${MAX_FILE_SIZE_MB}MB.`)
  }

  // Compress image
  const compressedFile = await compressImage(file)

  // Generate unique filename: timestamp-originalname
  const timestamp = Date.now()
  const fileExt = file.name.split('.').pop()
  // Remove extension from original name to avoid double extension (e.g. image.jpg.jpg)
  const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'))
  const fileName = `${timestamp}-${nameWithoutExt.substring(0, 50)}.${fileExt}`

  // Path structure: {user_id}/{filename}
  const filePath = `${userId}/${fileName}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, compressedFile, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    throw new Error('Errore durante l\'upload dell\'immagine')
  }

  // Return storage path (not public URL) for private bucket
  return data.path
}

/**
 * Delete image from Supabase Storage
 * @param imagePathOrUrl - Storage path or URL of the image to delete
 * @param userId - User ID (for validation)
 */
export async function deleteFoodImage(imagePathOrUrl: string, userId: string): Promise<void> {
  try {
    // Extract path from URL if needed (backward compatibility)
    const imagePath = extractPathFromUrlOrPath(imagePathOrUrl)

    // Verify path starts with user_id for security
    if (!imagePath.startsWith(userId)) {
      throw new Error('Non autorizzato a eliminare questa immagine')
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([imagePath])

    if (error) {
      console.error('Delete error:', error)
      throw new Error('Errore durante l\'eliminazione dell\'immagine')
    }
  } catch (error) {
    console.error('Error deleting image:', error)
    // Non propaghiamo l'errore se l'immagine non esiste più
    if (error instanceof Error && !error.message.includes('not found')) {
      throw error
    }
  }
}

/**
 * Get signed URL for private image
 * @param imagePath - Storage path (e.g. "user_id/filename.jpg")
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL that expires after the specified time
 * @throws Error if image retrieval fails (except for missing images)
 */
export async function getSignedImageUrl(imagePath: string, expiresIn: number = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(imagePath, expiresIn)

  if (error) {
    // Check if error is "Object not found" - this is expected for deleted images
    const isNotFound = error.message?.toLowerCase().includes('object not found') ||
                       error.message?.toLowerCase().includes('not found')

    if (isNotFound) {
      // Don't spam console with expected errors for missing images
      // This happens when images are deleted from storage but DB still has references
      throw new Error('IMAGE_NOT_FOUND')
    }

    // For other errors, log and throw
    console.error('Error creating signed URL:', error)
    throw new Error('Errore durante il recupero dell\'immagine')
  }

  return data.signedUrl
}

/**
 * Get signed URLs for multiple image paths
 * @param imagePaths - Array of storage paths
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Map of path to signed URL
 */
export async function getSignedImageUrls(
  imagePaths: string[],
  expiresIn: number = 3600
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()

  // Generate signed URLs in parallel
  const promises = imagePaths.map(async (path) => {
    try {
      const signedUrl = await getSignedImageUrl(path, expiresIn)
      urlMap.set(path, signedUrl)
    } catch (error) {
      console.error(`Failed to generate signed URL for ${path}:`, error)
      // Don't add to map if failed
    }
  })

  await Promise.all(promises)

  return urlMap
}
