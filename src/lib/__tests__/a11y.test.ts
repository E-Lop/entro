import { describe, it, expect } from 'vitest'
import { inlineErrorAttrs } from '../a11y'

describe('inlineErrorAttrs', () => {
  it('in errore: aria-invalid true e describedby = id messaggio', () => {
    expect(inlineErrorAttrs(true, 'pwd-error')).toEqual({
      'aria-invalid': true,
      'aria-describedby': 'pwd-error',
    })
  })

  it('senza errore e senza hint: entrambi omessi (undefined)', () => {
    expect(inlineErrorAttrs(false, 'pwd-error')).toEqual({
      'aria-invalid': undefined,
      'aria-describedby': undefined,
    })
  })

  it('senza errore ma con hint: describedby = id hint, aria-invalid omesso', () => {
    expect(inlineErrorAttrs(false, 'code-error', 'code-hint')).toEqual({
      'aria-invalid': undefined,
      'aria-describedby': 'code-hint',
    })
  })
})
