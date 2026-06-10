// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QuickGuideDialog } from '../QuickGuideDialog'

afterEach(cleanup)

function renderGuide() {
  return render(
    <MemoryRouter>
      <QuickGuideDialog />
    </MemoryRouter>
  )
}

describe('QuickGuideDialog — stato di scadenza', () => {
  it('descrive lo stato con segnali non solo cromatici (giorni + etichetta)', async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.click(screen.getByRole('button', { name: 'Guida rapida' }))

    const dialog = await screen.findByRole('dialog')
    // menziona i giorni mancanti, non solo i colori
    expect(dialog.textContent).toMatch(/giorni/i)
    expect(dialog.textContent).toMatch(/etichetta/i)
  })

  it('non descrive tier di colore inesistenti (Giallo 4-7 / Arancione 1-3)', async () => {
    const user = userEvent.setup()
    renderGuide()
    await user.click(screen.getByRole('button', { name: 'Guida rapida' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).not.toMatch(/Giallo/i)
    expect(dialog.textContent).not.toMatch(/Arancione/i)
  })
})
