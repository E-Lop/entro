import { useState, useCallback, useRef, useEffect } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

export type ScannerState = 'idle' | 'scanning' | 'processing' | 'success' | 'error'

interface UsBarcodeScannerOptions {
  onScanSuccess?: (barcode: string) => void
  onScanError?: (error: Error) => void
}

export function useBarcodeScanner({ onScanSuccess, onScanError }: UsBarcodeScannerOptions = {}) {
  const [state, setState] = useState<ScannerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)

  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const elementIdRef = useRef<string>(`barcode-scanner-${Date.now()}`)

  /**
   * Start scanning
   */
  const startScanning = useCallback(async () => {
    try {
      setState('scanning')
      setError(null)
      setScannedCode(null)

      // Initialize reader if not already initialized
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader()
      }

      const reader = readerRef.current

      // Get video element
      const videoElement = document.getElementById(elementIdRef.current) as HTMLVideoElement
      if (!videoElement) {
        throw new Error('Video element not found')
      }

      videoRef.current = videoElement

      console.log('Starting ZXing scanner...')

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API fotocamera non disponibile su questo browser')
      }

      // Get available video devices (cameras)
      let devices: MediaDeviceInfo[] = []
      try {
        devices = await BrowserMultiFormatReader.listVideoInputDevices()
        console.log('Available cameras:', devices.length)
      } catch (err) {
        console.warn('Error listing cameras:', err)
        // Continue with undefined deviceId to use default camera
      }

      // Try to find back camera on mobile, otherwise use first available
      let selectedDeviceId: string | undefined

      if (devices.length > 0) {
        const backCamera = devices.find(
          (device: MediaDeviceInfo) =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('rear') ||
            device.label.toLowerCase().includes('environment')
        )
        selectedDeviceId = backCamera?.deviceId || devices[0]?.deviceId
        console.log('Using camera:', selectedDeviceId)
      } else {
        // Fallback: use undefined to let browser choose default camera
        console.log('Using default camera (no devices listed)')
        selectedDeviceId = undefined
      }

      // Start continuous decoding from video device
      await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoElement,
        (result, error) => {
          if (result) {
            // Successfully scanned
            const barcode = result.getText()
            console.log('Barcode scanned:', barcode)

            setState('processing')
            setScannedCode(barcode)

            // Stop scanning - stopContinuousDecode doesn't exist, need to track stream
            // The stream will be stopped when we call reset on stopScanning

            setState('success')
            onScanSuccess?.(barcode)
          }

          // Ignore NotFoundException - it's normal when no code is in view
          if (error && !(error instanceof NotFoundException)) {
            console.debug('Scan error:', error.message)
          }
        }
      )

      console.log('Scanner started successfully')
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
      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
        console.log('Video stream stopped')
      }

      // Stop stream ref if exists
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      setState('idle')
      setError(null)
    } catch (err) {
      console.error('Error stopping scanner:', err)
      const errorMsg = err instanceof Error ? err.message : 'Errore durante la chiusura dello scanner'
      setError(errorMsg)
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
      try {
        // Stop video stream
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream
          stream.getTracks().forEach(track => track.stop())
          videoRef.current.srcObject = null
        }

        // Stop stream ref if exists
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        readerRef.current = null
        console.log('Scanner cleaned up')
      } catch (err) {
        console.error('Error cleaning up scanner:', err)
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
