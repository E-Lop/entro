// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../dialog'

afterEach(cleanup)

describe('DialogContent close button', () => {
  it('labels the close control in Italian with a 44px touch target', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Titolo</DialogTitle>
          </DialogHeader>
          Contenuto
        </DialogContent>
      </Dialog>
    )
    // The accessible name comes from the sr-only "Chiudi" span (was "Close").
    const close = screen.getByRole('button', { name: 'Chiudi' })
    expect(close.className).toContain('h-11')
    expect(close.className).toContain('w-11')
  })
})
