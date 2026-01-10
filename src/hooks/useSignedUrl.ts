import { useState, useEffect } from 'react'
import { getSignedImageUrl } from '@/lib/storage'

/**
 * Hook to generate and manage signed URL for a storage path
 * @param storagePath - Storage path (e.g. "user_id/filename.jpg") or null
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Object with signed URL, loading state, and error
 */
export function useSignedUrl(storagePath: string | null | undefined, expiresIn: number = 3600) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Reset state when path changes
    setSignedUrl(null)
    setError(null)

    // If no path, nothing to load
    if (!storagePath) {
      setIsLoading(false)
      return
    }

    // If it's already a full URL (signed or public), use it as is
    if (storagePath.startsWith('http')) {
      setSignedUrl(storagePath)
      setIsLoading(false)
      return
    }

    // Generate signed URL for storage path
    let isCancelled = false
    setIsLoading(true)

    getSignedImageUrl(storagePath, expiresIn)
      .then((url) => {
        if (!isCancelled) {
          setSignedUrl(url)
          setError(null)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Error generating signed URL:', err)
          setError(err instanceof Error ? err : new Error('Errore nel caricamento dell\'immagine'))
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    // Cleanup function to prevent state updates after unmount
    return () => {
      isCancelled = true
    }
  }, [storagePath, expiresIn])

  return { signedUrl, isLoading, error }
}
