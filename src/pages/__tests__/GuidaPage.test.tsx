// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GuidaPage } from '../GuidaPage'

afterEach(cleanup)

function renderGuida() {
  return render(
    <MemoryRouter>
      <GuidaPage />
    </MemoryRouter>
  )
}

describe('GuidaPage — gerarchia heading', () => {
  it('espone un solo h1 "Guida utente"', () => {
    renderGuida()
    expect(screen.getByRole('heading', { level: 1, name: 'Guida utente' })).toBeTruthy()
  })

  it('le sezioni sono heading di livello 2 (niente salto h1→h3)', () => {
    renderGuida()
    // Le card-titolo, prima rese come <div>, ora sono <h2>
    expect(screen.getByRole('heading', { level: 2, name: /Aggiungere alimenti/ })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: /Domande frequenti/ })).toBeTruthy()
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s.length).toBeGreaterThanOrEqual(10)
  })
})

describe('GuidaPage — legenda stato di scadenza', () => {
  it('insegna i 3 stati reali con etichette testuali (segnale non solo cromatico)', () => {
    renderGuida()
    expect(screen.getByRole('heading', { level: 3, name: 'Stato di scadenza' })).toBeTruthy()
    // Le etichette reali dei badge dell'app sono testuali, non solo colore
    expect(screen.getByText('Scade oggi')).toBeTruthy()
    expect(screen.getByText('Scaduto')).toBeTruthy()
  })

  it('non insegna i tier di colore inesistenti (Giallo 4-7 / Arancione 1-3)', () => {
    renderGuida()
    expect(screen.queryByText(/Giallo/i)).toBeNull()
    expect(screen.queryByText(/Arancione/i)).toBeNull()
  })
})

describe('GuidaPage — etichette UI allineate al reale', () => {
  it('usa l\'etichetta corrente "Crea invito" (non più "Invita membro")', () => {
    renderGuida()
    expect(screen.getByText(/Crea invito/)).toBeTruthy()
    expect(screen.queryByText(/Invita membro/)).toBeNull()
  })
})
