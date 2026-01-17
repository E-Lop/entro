import { useState, useCallback, useRef, useEffect } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader, IScannerControls } from '@zxing/browser'
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
  const controlsRef = useRef<IScannerControls | null>(null)
  const mountedRef = useRef<boolean>(true)
  const hasScannedRef = useRef<boolean>(false)
  const elementIdRef = useRef<string>(`barcode-scanner-${Date.now()}`)

  /**
   * Start scanning
   */
  const startScanning = useCallback(async () => {
    try {
      setState('scanning')
      setError(null)
      setScannedCode(null)
      hasScannedRef.current = false // Reset scan flag

      // Initialize reader with delay configuration to prevent callback spam
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanSuccess: 2000, // 2 second delay after successful scan
          delayBetweenScanAttempts: 600, // 600ms delay between scan attempts
        })
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

      // CRITICAL FIX for iOS: Always use undefined deviceId
      // iOS doesn't provide descriptive labels for cameras until after first use,
      // and manual deviceId selection can result in selecting the wrong camera.
      // Using undefined lets the browser automatically select the appropriate camera,
      // which works reliably on both iOS and Android.
      const selectedDeviceId: string | undefined = undefined
      console.log('Using browser default camera (undefined deviceId for best compatibility)')

      // Start continuous decoding from video device
      // CRITICAL: Save the controls object returned by decodeFromVideoDevice
      const controls = await reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoElement,
        (result, error, controls) => {
          // Check if component is still mounted - stop if unmounted
          if (!mountedRef.current) {
            console.log('Component unmounted, stopping scanner')
            controls.stop()
            return
          }

          if (result && !hasScannedRef.current) {
            // Successfully scanned - only process ONCE
            hasScannedRef.current = true

            const barcode = result.getText()
            console.log('Barcode scanned:', barcode)

            // CRITICAL FIX: Stop scanner controls IMMEDIATELY
            console.log('Calling controls.stop()...')
            controls.stop()
            console.log('Scanner controls stopped')

            // Stop video stream
            if (videoRef.current && videoRef.current.srcObject) {
              const stream = videoRef.current.srcObject as MediaStream
              stream.getTracks().forEach(track => {
                track.stop()
                console.log('Track stopped:', track.kind)
              })
              videoRef.current.srcObject = null
              console.log('Video stream stopped after scan')
            }

            setState('processing')
            setScannedCode(barcode)
            setState('success')
            onScanSuccess?.(barcode)
          }

          // Ignore NotFoundException - it's normal when no code is in view
          if (error && !(error instanceof NotFoundException)) {
            console.debug('Scan error:', error.message)
          }
        }
      )

      // Save controls reference for external stop
      controlsRef.current = controls
      console.log('Scanner started successfully, controls saved')
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
   * Stop scanning with complete cleanup
   */
  const stopScanning = useCallback(async () => {
    try {
      console.log('Stopping scanner...')
      hasScannedRef.current = false // Reset scan flag

      // Stop scanner controls first
      if (controlsRef.current) {
        try {
          controlsRef.current.stop()
          console.log('Scanner controls stopped')
        } catch (err) {
          console.warn('Error stopping scanner controls:', err)
        }
        controlsRef.current = null
      }

      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => {
          track.stop()
          console.log('Track stopped:', track.kind, track.label)
        })
        videoRef.current.srcObject = null
        console.log('Video stream stopped')
      }

      // Release all ZXing streams (global cleanup)
      try {
        BrowserCodeReader.releaseAllStreams()
        console.log('All ZXing streams released')
      } catch (err) {
        console.warn('Error releasing streams:', err)
      }

      // Clean video element source
      if (videoRef.current) {
        try {
          BrowserCodeReader.cleanVideoSource(videoRef.current)
          console.log('Video source cleaned')
        } catch (err) {
          console.warn('Error cleaning video source:', err)
        }
      }

      // CRITICAL FIX: Reset reader instance to force fresh initialization on next scan
      // This prevents iOS from reusing the previous camera selection
      if (readerRef.current) {
        // Nullify to force new instance on next scan
        readerRef.current = null
        console.log('Reader instance nullified - will create fresh instance on next scan')
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
    hasScannedRef.current = false // Reset scan flag
    setState('idle')
    setError(null)
    setScannedCode(null)
  }, [])

  /**
   * Manage mounted state and cleanup on unmount
   */
  useEffect(() => {
    mountedRef.current = true

    return () => {
      // Mark component as unmounted
      mountedRef.current = false
      console.log('Component unmounting, cleaning up scanner...')

      // Perform complete cleanup
      stopScanning()
    }
  }, [stopScanning])

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
