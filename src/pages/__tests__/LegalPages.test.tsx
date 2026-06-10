// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyPolicyPage } from '../PrivacyPolicyPage'
import { TermsPage } from '../TermsPage'

afterEach(cleanup)

function renderPage(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('PrivacyPolicyPage — gerarchia heading', () => {
  it('espone un h1 "Privacy Policy"', () => {
    renderPage(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeTruthy()
  })

  it('il banner "Documento in preparazione" è un heading (non testo orfano) sotto l\'h1', () => {
    renderPage(<PrivacyPolicyPage />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Documento in preparazione' })
    ).toBeTruthy()
  })

  it('usa sentence-case italiano nelle sezioni', () => {
    renderPage(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: 'Cosa raccoglie entro' })).toBeTruthy()
    expect(screen.queryByText('Cosa Raccoglie entro')).toBeNull()
  })
})

describe('TermsPage — gerarchia heading', () => {
  it('espone un h1 "Termini e condizioni"', () => {
    renderPage(<TermsPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Termini e condizioni' })).toBeTruthy()
  })

  it('il banner "Documento in preparazione" è un heading di livello 2', () => {
    renderPage(<TermsPage />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Documento in preparazione' })
    ).toBeTruthy()
  })

  it('usa sentence-case italiano nelle sezioni', () => {
    renderPage(<TermsPage />)
    expect(screen.getByRole('heading', { name: 'Account utente' })).toBeTruthy()
    expect(screen.queryByText('Account Utente')).toBeNull()
  })
})
