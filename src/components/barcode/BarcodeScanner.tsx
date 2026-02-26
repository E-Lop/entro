import { useEffect, useRef } from 'react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Camera, AlertCircle, CheckCircle2, Flashlight, FlashlightOff } from 'lucide-react'

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (barcode: string) => void
}

/**
 * BarcodeScanner Component - Modal dialog for scanning barcodes
 * Uses @zxing/browser library to access device camera and scan EAN/UPC/QR barcodes
 */
export function BarcodeScanner({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) {
  const isClosingRef = useRef(false)

  const {
    state,
    error,
    scannedCode,
    elementId,
    startScanning,
    stopScanning,
    reset,
    isTorchAvailable,
    isTorchOn,
    toggleTorch,
    isScanning,
    isProcessing,
    isSuccess,
    isError,
  } = useBarcodeScanner({
    onScanSuccess: (barcode) => {
      // Stop scanner and close IMMEDIATELY - no delay
      isClosingRef.current = true
      stopScanning()
      onScanSuccess(barcode)
      onOpenChange(false)
    },
    onScanError: (err) => {
      console.error('Barcode scan error:', err)
    },
  })

  // Auto-start scanning when dialog opens
  useEffect(() => {
    if (open && !isClosingRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanning()
      }, 300)

      return () => clearTimeout(timer)
    } else if (!open) {
      // Stop scanning when dialog closes
      stopScanning()
      reset()
      isClosingRef.current = false // Reset flag
    }
  }, [open, startScanning, stopScanning, reset])

  const handleClose = () => {
    stopScanning()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scansiona Barcode
          </DialogTitle>
          <DialogDescription>
            Inquadra il codice a barre del prodotto per caricarne i dati automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner View */}
          <div className="relative min-h-[300px] bg-black rounded-lg overflow-hidden">
            {/* Video element for ZXing scanner */}
            <video
              id={elementId}
              className="w-full h-auto max-h-[400px]"
              style={{
                display: state === 'idle' ? 'none' : 'block',
              }}
            />

            {/* Torch toggle button */}
            {isScanning && isTorchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/70 active:bg-black/80"
                aria-label={isTorchOn ? 'Disattiva flash' : 'Attiva flash'}
              >
                {isTorchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
              </button>
            )}

            {/* Loading state overlay */}
            {state === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Inizializzazione fotocamera...</p>
                </div>
              </div>
            )}

            {/* Processing overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                <div className="bg-background p-4 rounded-lg flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Elaborazione...</p>
                </div>
              </div>
            )}

            {/* Success overlay */}
            {isSuccess && scannedCode && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                <div className="bg-background p-4 rounded-lg flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p className="text-sm font-medium">Codice riconosciuto!</p>
                  <p className="text-xs text-muted-foreground font-mono">{scannedCode}</p>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {isError && error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Errore</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Instructions */}
          {isScanning && (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Posiziona il codice a barre all'interno del riquadro
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs text-muted-foreground">Scanner attivo</p>
              </div>
            </div>
          )}

          {/* Retry button for errors */}
          {isError && (
            <div className="flex gap-2">
              <Button onClick={startScanning} className="flex-1" variant="default">
                <Camera className="mr-2 h-4 w-4" />
                Riprova
              </Button>
              <Button onClick={handleClose} className="flex-1" variant="outline">
                Annulla
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
