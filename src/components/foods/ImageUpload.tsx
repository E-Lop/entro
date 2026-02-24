import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Camera } from 'lucide-react'
import { Button } from '../ui/button'
import { useSignedUrl } from '@/hooks/useSignedUrl'

interface ImageUploadProps {
  /** Current image: File (new upload), string (existing path), or null */
  value?: File | string | null
  /** Callback when image is selected or removed */
  onChange: (image: File | string | null) => void
  /** Disable upload */
  disabled?: boolean
}

/**
 * ImageUpload Component - Select food images with local preview
 * Upload happens on form submit, not immediately
 * Supports HEIC/HEIF (iPhone) with automatic conversion to JPEG
 */
export function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null) // Local file preview (FileReader)
  const [error, setError] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false) // HEIC conversion in progress
  const galleryInputRef = useRef<HTMLInputElement>(null) // Gallery picker
  const cameraInputRef = useRef<HTMLInputElement>(null) // Camera capture

  // Generate signed URL for existing image path (edit mode with string path)
  const existingImagePath = typeof value === 'string' ? value : null
  const { signedUrl, isLoading: signedUrlLoading, error: signedUrlError } = useSignedUrl(existingImagePath)

  // Update local preview when value changes
  useEffect(() => {
    if (!value) {
      // No value: clear preview
      setLocalPreview(null)
    } else if (value instanceof File) {
      // New File selected: create local preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setLocalPreview(reader.result as string)
      }
      reader.readAsDataURL(value)
    } else {
      // String path: clear local preview (will show signed URL instead)
      setLocalPreview(null)
    }
  }, [value])

  // Determine which preview to show: local (priority) or remote (signed URL)
  const displayPreview = localPreview || signedUrl
  const isLoadingPreview = !localPreview && signedUrlLoading && !!existingImagePath

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsConverting(false)

    // Check if file is HEIC/HEIF (iPhone format) and convert to JPEG
    const isHEIC =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')

    if (isHEIC) {
      try {
        setIsConverting(true)
        const { default: heic2any } = await import('heic2any')
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        })

        // heic2any can return Blob or Blob[], handle both cases
        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob

        // Create new File from converted Blob
        file = new File(
          [blob],
          file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
          { type: 'image/jpeg' }
        )
        setIsConverting(false)
      } catch (conversionError) {
        console.error('HEIC conversion error:', conversionError)
        setError('Errore nella conversione dell\'immagine HEIC. Riprova con un\'altra foto.')
        setIsConverting(false)
        return
      }
    }

    // Validate file type (after potential HEIC conversion)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo di file non valido. Usa JPG, PNG, WebP o HEIC (iPhone).')
      return
    }

    // Validate file size (5MB max)
    const MAX_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      setError('File troppo grande. Massimo 5MB.')
      return
    }

    // Pass File object to parent (no upload yet)
    onChange(file)
  }

  const handleRemove = () => {
    setLocalPreview(null)
    onChange(null)
    setError(null)
    // Clear both inputs
    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
  }

  const handleGalleryClick = () => {
    galleryInputRef.current?.click()
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      {/* Preview or Upload Button */}
      {displayPreview || isLoadingPreview || isConverting ? (
        <div className="relative group">
          {/* Image Preview */}
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            {isLoadingPreview ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Caricamento immagine...</p>
                </div>
              </div>
            ) : isConverting ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Conversione immagine HEIC...</p>
                </div>
              </div>
            ) : signedUrlError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <span className="text-xs">Errore caricamento</span>
              </div>
            ) : displayPreview ? (
              <img
                src={displayPreview}
                alt="Anteprima immagine alimento"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          {/* Remove Button */}
          {!disabled && !isLoadingPreview && !isConverting && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemove}
              aria-label="Rimuovi immagine"
            >
              <X className="w-4 h-4 mr-1" aria-hidden="true" />
              Rimuovi
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Two-button layout: Camera + Gallery */}
          <div className="grid grid-cols-2 gap-3">
            {/* Camera Button - Android 14+ compatible */}
            <Button
              type="button"
              variant="outline"
              className="h-32 flex flex-col items-center justify-center gap-2 border-dashed border-2"
              onClick={handleCameraClick}
              disabled={disabled || isConverting}
              aria-label="Scatta foto con fotocamera"
            >
              <Camera className="w-6 h-6 text-gray-400" aria-hidden="true" />
              <div className="text-center">
                <div className="text-sm font-medium">Fotocamera</div>
                <p className="text-xs text-gray-500 mt-1">Scatta foto</p>
              </div>
            </Button>

            {/* Gallery Button */}
            <Button
              type="button"
              variant="outline"
              className="h-32 flex flex-col items-center justify-center gap-2 border-dashed border-2"
              onClick={handleGalleryClick}
              disabled={disabled || isConverting}
              aria-label="Scegli foto dalla galleria"
            >
              <Upload className="w-6 h-6 text-gray-400" aria-hidden="true" />
              <div className="text-center">
                <div className="text-sm font-medium">Galleria</div>
                <p className="text-xs text-gray-500 mt-1">Scegli foto</p>
              </div>
            </Button>
          </div>

          {/* Hidden File Inputs */}
          {/* Camera input - uses capture to force camera on Android */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isConverting}
            aria-label="Input fotocamera"
          />
          {/* Gallery input - no capture, allows file picker */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isConverting}
            aria-label="Input galleria immagini"
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Help Text */}
      {!displayPreview && !error && !isLoadingPreview && !isConverting && (
        <p className="text-xs text-gray-500">
          L'immagine verrà automaticamente compressa e ridimensionata.
          Le foto iPhone (HEIC) vengono convertite in JPEG.
        </p>
      )}
    </div>
  )
}
