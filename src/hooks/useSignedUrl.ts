import { useState, useEffect, useRef } from 'react'
import { getSignedImageUrl } from '@/lib/storage'
import { getPendingImage, isPendingUrl } from '@/lib/pendingImages'

/**
 * Hook to generate and manage signed URL for a storage path.
 * Supports regular storage paths, full URLs, and pending:// references.
 */
export function useSignedUrl(storagePath: string | null | undefined, expiresIn: number = 3600) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Revoke previous blob URL if any
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }

    setSignedUrl(null)
    setError(null)

    if (!storagePath) {
      setIsLoading(false)
      return
    }

    // Already a full URL (signed or public) -- use as-is
    if (storagePath.startsWith('http')) {
      setSignedUrl(storagePath)
      setIsLoading(false)
      return
    }

    let isCancelled = false
    setIsLoading(true)

    const promise = isPendingUrl(storagePath)
      ? loadPendingImage(storagePath)
      : loadSignedUrl(storagePath, expiresIn)

    promise
      .then((url) => {
        if (!isCancelled) {
          setSignedUrl(url)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          const wrapped = err instanceof Error ? err : new Error('Errore nel caricamento dell\'immagine')
          if (wrapped.message !== 'IMAGE_NOT_FOUND') {
            console.error('Error loading image URL:', wrapped)
          }
          setError(wrapped)
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false)
      })

    return () => {
      isCancelled = true
      // Revoke blob URL on cleanup (unmount or path change)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [storagePath, expiresIn])

  /** Load a pending image from IndexedDB and return a blob URL. */
  function loadPendingImage(pendingUrl: string): Promise<string> {
    return getPendingImage(pendingUrl).then(({ buffer, type }) => {
      const url = URL.createObjectURL(new Blob([buffer], { type }))
      blobUrlRef.current = url
      return url
    })
  }

  /** Generate a signed URL, re-throwing IMAGE_NOT_FOUND silently. */
  function loadSignedUrl(path: string, expires: number): Promise<string> {
    return getSignedImageUrl(path, expires)
  }

  return { signedUrl, isLoading, error }
}
