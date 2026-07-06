// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { toast } from 'sonner'
import { useWelcomeToast } from '../useWelcomeToast'
import { notifyWelcomeToast, WELCOME_TOAST_FLAG } from '../../lib/welcomeToast'

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

function Harness() {
  useWelcomeToast()
  return null
}

describe('useWelcomeToast', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(toast.success).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('mostra il toast e pulisce il flag quando e\' gia\' presente al mount', () => {
    localStorage.setItem(WELCOME_TOAST_FLAG, 'true')

    render(<Harness />)

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(WELCOME_TOAST_FLAG)).toBeNull()
  })

  it('mostra il toast quando il flag viene impostato dopo il mount', () => {
    render(<Harness />)
    expect(toast.success).not.toHaveBeenCalled()

    notifyWelcomeToast()

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(WELCOME_TOAST_FLAG)).toBeNull()
  })

  it('non mostra nulla senza il flag', () => {
    render(<Harness />)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('non mostra il toast due volte per un singolo invito', () => {
    render(<Harness />)

    notifyWelcomeToast()
    // Un secondo evento senza nuovo invito non deve ri-mostrare il toast
    window.dispatchEvent(new Event('entro:welcome-toast'))

    expect(toast.success).toHaveBeenCalledTimes(1)
  })
})
