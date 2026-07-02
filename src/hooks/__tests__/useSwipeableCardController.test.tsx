// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SwipeableCardProvider, useSwipeableCard } from '../useSwipeableCardController'

afterEach(cleanup)

function Consumer({ id }: { id: string }) {
  const { isOpen, open } = useSwipeableCard(id)
  return (
    <div>
      <button onClick={open}>open-{id}</button>
      <span data-testid={`state-${id}`}>{isOpen ? 'open' : 'closed'}</span>
    </div>
  )
}

function renderList() {
  return render(
    <SwipeableCardProvider>
      <Consumer id="A" />
      <Consumer id="B" />
    </SwipeableCardProvider>,
  )
}

const state = (id: string) => screen.getByTestId(`state-${id}`).textContent

describe('useSwipeableCardController — una sola card aperta', () => {
  it('apre A', async () => {
    renderList()
    await userEvent.click(screen.getByText('open-A'))
    expect(state('A')).toBe('open')
    expect(state('B')).toBe('closed')
  })

  it('aprire B chiude A', async () => {
    renderList()
    await userEvent.click(screen.getByText('open-A'))
    await userEvent.click(screen.getByText('open-B'))
    expect(state('A')).toBe('closed')
    expect(state('B')).toBe('open')
  })
})

describe('useSwipeableCardController — chiusura allo scroll', () => {
  it('lo scroll verticale chiude la card aperta', async () => {
    renderList()
    await userEvent.click(screen.getByText('open-A'))
    expect(state('A')).toBe('open')
    fireEvent.scroll(window)
    expect(state('A')).toBe('closed')
  })
})

describe('useSwipeableCard — fallback senza provider', () => {
  it('gestisce lo stato localmente quando non c\'è provider', async () => {
    render(<Consumer id="solo" />)
    expect(state('solo')).toBe('closed')
    await userEvent.click(screen.getByText('open-solo'))
    expect(state('solo')).toBe('open')
  })
})
