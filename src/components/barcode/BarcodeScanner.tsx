import { useEffect } from 'react'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Camera, AlertCircle, CheckCircle2 } from 'lucide-react'

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (barcode: string) => void
}

/**
 * BarcodeScanner Component - Modal dialog for scanning barcodes
 * Uses html5-qrcode library to access device camera and scan EAN/UPC barcodes
 */
export function BarcodeScanner({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) {
  const {
    state,
    error,
    scannedCode,
    elementId,
    startScanning,
    stopScanning,
    reset,
    isScanning,
    isProcessing,
    isSuccess,
    isError,
  } = useBarcodeScanner({
    onScanSuccess: (barcode) => {
      // Short delay before closing to show success state
      setTimeout(() => {
        onScanSuccess(barcode)
        onOpenChange(false)
      }, 800)
    },
    onScanError: (err) => {
      console.error('Barcode scan error:', err)
    },
  })

  // Auto-start scanning when dialog opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanning()
      }, 300)

      return () => clearTimeout(timer)
    } else {
      // Stop scanning when dialog closes
      stopScanning()
      reset()
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

        {/* Inject CSS for html5-qrcode video */}
        <style>{`
          #${elementId} video {
            width: 100% !important;
            height: auto !important;
            max-height: 400px !important;
            display: block !important;
          }
          #${elementId} > div {
            width: 100% !important;
          }
        `}</style>

        <div className="space-y-4">
          {/* Scanner View */}
          <div className="relative">
            <div
              id={elementId}
              className="rounded-lg overflow-hidden bg-black min-h-[300px] w-full"
              style={{
                display: state === 'idle' ? 'flex' : 'block',
                alignItems: state === 'idle' ? 'center' : 'initial',
                justifyContent: state === 'idle' ? 'center' : 'initial',
              }}
            >
              {/* Loading state */}
              {state === 'idle' && (
                <div className="flex flex-col items-center gap-3 text-muted-foreground p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Inizializzazione fotocamera...</p>
                </div>
              )}
            </div>

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
