/**
 * La password degli utenti E2E ha una fonte sola (#186).
 *
 * Il 28 set 2026 era scritta a mano in 19 spec su 20. Vale solo sullo stack
 * locale, quindi non è un segreto: il problema è la deriva, la stessa che il
 * 31 ago 2026 è costata a entro-mobile un login «Invalid login credentials»
 * scambiato per un difetto dell'app.
 *
 * La fonte è `E2E_PASSWORD` in `tests/e2e/helpers/supabase.ts`. Le spec si
 * leggono come testo, e il modulo non si importa: crea un client al caricamento.
 *
 * Resta permessa una password sbagliata passata **direttamente** a un campo
 * (`fill('PasswordSbagliata!1')`): è il dato del test, non la password di un
 * utente di prova.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const E2E = join(__dirname, 'e2e')

function canonicalPassword(): string {
  const helpers = readFileSync(join(E2E, 'helpers', 'supabase.ts'), 'utf8')
  const found = helpers.match(/export const E2E_PASSWORD = '([^']+)'/)
  if (!found) throw new Error('E2E_PASSWORD non trovata in tests/e2e/helpers/supabase.ts')
  return found[1]
}

function specs(): [string, string][] {
  return readdirSync(E2E)
    .filter((name) => name.endsWith('.spec.ts'))
    .map((name) => [name, readFileSync(join(E2E, name), 'utf8')])
}

describe('la password degli utenti E2E', () => {
  it('trova le spec da controllare', () => {
    // Una lista vuota passerebbe sempre, ed è la forma peggiore di verde.
    expect(specs().length).toBeGreaterThanOrEqual(19)
  })

  it('nessuna spec contiene la password canonica', () => {
    const password = canonicalPassword()
    const offenders = specs()
      .filter(([, source]) => source.includes(password))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it('nessuna spec assegna una password scritta a mano', () => {
    // `const password = '…'`, `let coMemberPassword = "…"`, `password: '…'`:
    // un letterale dato a un nome che contiene «password».
    const assignment = /\b\w*password\w*\s*[:=]\s*['"`]/i
    const offenders = specs().flatMap(([name, source]) =>
      source
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => assignment.test(line))
        .map(({ line, index }) => `${name}:${index + 1} → ${line.trim()}`)
    )
    expect(offenders).toEqual([])
  })
})
