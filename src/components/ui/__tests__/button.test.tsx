import { describe, it, expect } from 'vitest'
import { buttonVariants } from '../button'

describe('buttonVariants touch sizes', () => {
  it('exposes a 44px "touch" size for thumb-first controls', () => {
    expect(buttonVariants({ size: 'touch' })).toContain('h-11')
  })

  it('exposes a 44px square "icon-touch" size', () => {
    const cls = buttonVariants({ size: 'icon-touch' })
    expect(cls).toContain('h-11')
    expect(cls).toContain('w-11')
  })

  it('leaves the desktop defaults untouched (no global blast radius)', () => {
    expect(buttonVariants({ size: 'default' })).toContain('h-9')
    expect(buttonVariants({ size: 'icon' })).toContain('h-9')
  })
})
