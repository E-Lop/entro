import { useState, useRef, ChangeEvent, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
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
 */
export function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null) // Local file preview (FileReader)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Tipo di file non valido. Usa JPG, PNG o WebP.')
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
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-2">
      {/* Preview or Upload Button */}
      {displayPreview || isLoadingPreview ? (
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
            ) : signedUrlError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <ImageIcon className="w-12 h-12 mb-2" />
                <span className="text-xs">Errore caricamento</span>
              </div>
            ) : displayPreview ? (
              <img
                src={displayPreview}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          {/* Remove Button */}
          {!disabled && !isLoadingPreview && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRemove}
            >
              <X className="w-4 h-4 mr-1" />
              Rimuovi
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Upload Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-48 flex flex-col items-center justify-center gap-2 border-dashed border-2"
            onClick={handleButtonClick}
            disabled={disabled}
          >
            <ImageIcon className="w-8 h-8 text-gray-400" />
            <div className="text-center">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Upload className="w-4 h-4" />
                Seleziona immagine
              </div>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG o WebP (max 5MB)
              </p>
            </div>
          </Button>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Help Text */}
      {!displayPreview && !error && !isLoadingPreview && (
        <p className="text-xs text-gray-500">
          L'immagine verrà automaticamente compressa e ridimensionata
        </p>
      )}
    </div>
  )
}
