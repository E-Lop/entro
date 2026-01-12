import { useState, useCallback, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export type ScannerState = 'idle' | 'scanning' | 'processing' | 'success' | 'error'

interface UsBarcodeScannerOptions {
  onScanSuccess?: (barcode: string) => void
  onScanError?: (error: Error) => void
}

export function useBarcodeScanner({ onScanSuccess, onScanError }: UsBarcodeScannerOptions = {}) {
  const [state, setState] = useState<ScannerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const elementIdRef = useRef<string>(`barcode-scanner-${Date.now()}`)

  /**
   * Start scanning
   */
  const startScanning = useCallback(async () => {
    try {
      setState('scanning')
      setError(null)
      setScannedCode(null)

      // Initialize scanner if not already initialized
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementIdRef.current)
      }

      const scanner = scannerRef.current

      // Request camera permissions and start scanning
      await scanner.start(
        { facingMode: 'environment' }, // Use back camera on mobile
        {
          fps: 10, // Scans per second
          // Use function to dynamically calculate qrbox based on actual video dimensions
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Use 70% of the smaller dimension to ensure it fits
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight)
            const qrboxSize = Math.floor(minDimension * 0.7)
            console.log(`Video dimensions: ${viewfinderWidth}x${viewfinderHeight}, qrbox: ${qrboxSize}`)
            return { width: qrboxSize, height: qrboxSize }
          },
        },
        (decodedText: string) => {
          // Successfully scanned
          console.log('Barcode scanned:', decodedText)
          setState('processing')
          setScannedCode(decodedText)

          // Stop scanning
          scanner
            .stop()
            .then(() => {
              setState('success')
              onScanSuccess?.(decodedText)
            })
            .catch((err) => {
              console.error('Error stopping scanner:', err)
              setState('error')
              setError('Errore durante la chiusura dello scanner')
              onScanError?.(err)
            })
        },
        (errorMessage: string) => {
          // This is called continuously while scanning, ignore decode errors
          // Only log if it's not a "No QR code found" message
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.debug('Scan error:', errorMessage)
          }
        }
      )
    } catch (err) {
      console.error('Error starting scanner:', err)
      const errorMsg =
        err instanceof Error ? err.message : 'Impossibile avviare la fotocamera. Controlla i permessi.'
      setState('error')
      setError(errorMsg)
      onScanError?.(err instanceof Error ? err : new Error(errorMsg))
    }
  }, [onScanSuccess, onScanError])

  /**
   * Stop scanning
   */
  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current) {
        // Check if scanner is actually running before stopping
        const isRunning = scannerRef.current.getState?.() === 1 // 1 = SCANNING state
        if (isRunning) {
          await scannerRef.current.stop()
        }
      }
      setState('idle')
      setError(null)
    } catch (err) {
      console.error('Error stopping scanner:', err)
      // Don't show error to user if it's just a "not running" error
      if (err instanceof Error && !err.message.includes('not running')) {
        const errorMsg = 'Errore durante la chiusura dello scanner'
        setError(errorMsg)
      }
    }
  }, [])

  /**
   * Reset scanner state
   */
  const reset = useCallback(() => {
    setState('idle')
    setError(null)
    setScannedCode(null)
  }, [])

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cleanup scanner when component unmounts
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch((err) => console.error('Error cleaning up scanner:', err))
          .finally(() => {
            scannerRef.current?.clear()
            scannerRef.current = null
          })
      }
    }
  }, [])

  return {
    state,
    error,
    scannedCode,
    elementId: elementIdRef.current,
    startScanning,
    stopScanning,
    reset,
    isScanning: state === 'scanning',
    isProcessing: state === 'processing',
    isSuccess: state === 'success',
    isError: state === 'error',
  }
}
