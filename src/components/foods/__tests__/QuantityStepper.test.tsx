// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantityStepper } from '../QuantityStepper'

afterEach(cleanup)

const minus = () => screen.getByRole('button', { name: 'Diminuisci quantità' }) as HTMLButtonElement
const plus = () => screen.getByRole('button', { name: 'Aumenta quantità' }) as HTMLButtonElement

describe('QuantityStepper — incremento/decremento', () => {
  it('+ chiama onChange con la quantità aumentata di uno step', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} unit="pz" onChange={onChange} />)
    await userEvent.click(plus())
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('− chiama onChange con la quantità diminuita di uno step', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} unit="pz" onChange={onChange} />)
    await userEvent.click(minus())
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('rispetta lo step per unità di peso/volume (kg = 0.1)', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={0.2} unit="kg" onChange={onChange} />)
    await userEvent.click(plus())
    expect(onChange).toHaveBeenCalledWith(0.3)
    await userEvent.click(minus())
    expect(onChange).toHaveBeenCalledWith(0.1)
  })
})

describe('QuantityStepper — safeguard distruttivo (mai 0)', () => {
  it('− è disabilitato quando si è già al minimo', () => {
    render(<QuantityStepper value={1} unit="pz" onChange={vi.fn()} />)
    expect(minus().disabled).toBe(true)
  })

  it('− è disabilitato anche per il minimo di kg (0.1)', () => {
    render(<QuantityStepper value={0.1} unit="kg" onChange={vi.fn()} />)
    expect(minus().disabled).toBe(true)
  })
})

describe('QuantityStepper — quantità assente (null)', () => {
  it('mostra "—", disabilita − e il primo + imposta il minimo', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={null} unit="pz" onChange={onChange} />)
    expect(screen.getByText('—')).toBeTruthy()
    expect(minus().disabled).toBe(true)
    await userEvent.click(plus())
    expect(onChange).toHaveBeenCalledWith(1)
  })
})

describe('QuantityStepper — tap-to-type', () => {
  it('tocca il valore per digitare un numero preciso e conferma con Enter', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} unit="pz" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Quantità: 2 pz/ }))
    const input = screen.getByRole('spinbutton', { name: 'Quantità' })
    await userEvent.clear(input)
    await userEvent.type(input, '5{Enter}')
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('digitare 0 viene riportato al minimo (validation: DB richiede > 0)', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={3} unit="pz" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Quantità: 3 pz/ }))
    const input = screen.getByRole('spinbutton', { name: 'Quantità' })
    await userEvent.clear(input)
    await userEvent.type(input, '0{Enter}')
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('il segno meno è bloccato: "-5" viene trattato come 5', async () => {
    const onChange = vi.fn()
    render(<QuantityStepper value={2} unit="pz" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Quantità: 2 pz/ }))
    const input = screen.getByRole('spinbutton', { name: 'Quantità' })
    await userEvent.clear(input)
    await userEvent.type(input, '-5{Enter}')
    expect(onChange).toHaveBeenCalledWith(5)
  })
})

describe('QuantityStepper — accessibilità', () => {
  it('annuncia il valore corrente con aria-live', () => {
    const { container } = render(<QuantityStepper value={2} unit="confezioni" onChange={vi.fn()} />)
    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toContain('2')
  })
})
