// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { InviteMenuItem } from '../InviteMenuItem'

function renderInMenu(onSelect = vi.fn()) {
  render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <InviteMenuItem onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return onSelect
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_SHARED_LISTS', 'true')
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('InviteMenuItem', () => {
  it('si renderizza come vero menuitem (non un button generico)', async () => {
    renderInMenu()
    const item = await screen.findByRole('menuitem', { name: /Inviti/ })
    expect(item).toBeTruthy()
  })

  it('invoca onSelect quando attivato', async () => {
    const user = userEvent.setup()
    const onSelect = renderInMenu()
    const item = await screen.findByRole('menuitem', { name: /Inviti/ })
    await user.click(item)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('non rende nulla quando la feature è disattivata', async () => {
    vi.stubEnv('VITE_ENABLE_SHARED_LISTS', 'false')
    renderInMenu()
    expect(screen.queryByRole('menuitem', { name: /Inviti/ })).toBeNull()
  })
})
