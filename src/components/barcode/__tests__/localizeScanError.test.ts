import { describe, it, expect } from 'vitest'
import { localizeScanError } from '../BarcodeScanner'

describe('localizeScanError', () => {
  it('maps the raw "Not supported" browser error to Italian guidance', () => {
    const out = localizeScanError('Not supported')
    expect(out).not.toBe('Not supported')
    expect(out.toLowerCase()).toContain('non supportato')
  })

  it('maps permission/NotAllowed errors to permission guidance', () => {
    expect(localizeScanError('NotAllowedError: Permission denied').toLowerCase()).toContain('permesso')
    expect(localizeScanError('The request is not allowed').toLowerCase()).toContain('permesso')
  })

  it('maps missing-camera and busy-camera errors', () => {
    expect(localizeScanError('NotFoundError').toLowerCase()).toContain('nessuna fotocamera')
    expect(localizeScanError('NotReadableError: Could not start video source').toLowerCase()).toContain('occupata')
  })

  it('passes through an already-Italian message unchanged', () => {
    const msg = 'API fotocamera non disponibile su questo browser'
    expect(localizeScanError(msg)).toBe(msg)
  })
})
