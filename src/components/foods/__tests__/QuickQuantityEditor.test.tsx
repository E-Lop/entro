// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager } from '@tanstack/react-query'
import { toast } from 'sonner'
import { QuickQuantityEditor } from '../QuickQuantityEditor'
import type { Food } from '@/lib/foods'

const mutate = vi.fn()
vi.mock('@/hooks/useFoods', () => ({
  useUpdateFood: () => ({ mutate, isPending: false }),
}))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }))

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Fileni Cotosnella Spinaci',
    quantity: 1,
    quantity_unit: 'confezioni',
    ...overrides,
  } as Food
}

beforeEach(() => {
  mutate.mockClear()
  vi.spyOn(onlineManager, 'isOnline').mockReturnValue(true)
})
afterEach(cleanup)

describe('QuickQuantityEditor — persistenza', () => {
  it('alla chiusura salva la quantità modificata con {id, data:{quantity}}', async () => {
    const { unmount } = render(<QuickQuantityEditor food={makeFood({ quantity: 1 })} onOpenFullEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Aumenta quantità' }))
    unmount() // la card si chiude → flush della modifica pendente
    expect(mutate).toHaveBeenCalledWith({ id: 'food-1', data: { quantity: 2 } })
  })

  it('non salva nulla se la quantità non è cambiata', async () => {
    const { unmount } = render(<QuickQuantityEditor food={makeFood({ quantity: 2 })} onOpenFullEdit={vi.fn()} />)
    unmount()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('mostra il toast offline quando non si è online', async () => {
    vi.spyOn(onlineManager, 'isOnline').mockReturnValue(false)
    const { unmount } = render(<QuickQuantityEditor food={makeFood({ quantity: 1 })} onOpenFullEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Aumenta quantità' }))
    unmount()
    expect(mutate).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('offline'))
  })
})

describe('QuickQuantityEditor — UI', () => {
  it('"Modifica completa" invoca onOpenFullEdit', async () => {
    const onOpenFullEdit = vi.fn()
    render(<QuickQuantityEditor food={makeFood()} onOpenFullEdit={onOpenFullEdit} />)
    await userEvent.click(screen.getByRole('button', { name: /Modifica completa/ }))
    expect(onOpenFullEdit).toHaveBeenCalled()
  })

  it('mostra il nome dell\'alimento e "—" quando la quantità è assente', () => {
    render(<QuickQuantityEditor food={makeFood({ quantity: null, quantity_unit: null })} onOpenFullEdit={vi.fn()} />)
    expect(screen.getByText('Fileni Cotosnella Spinaci')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})
