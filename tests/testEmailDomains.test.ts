/**
 * Gli indirizzi email negli script e nei test stanno su domini che nessuno può
 * registrare (#234).
 *
 * La regola è di famiglia: `entro-family/conventions/test-data.md`, Regola 1.
 * Chi registra un dominio ne riceve la posta, e con un reset della password si
 * prende l'account: in produzione si provava con un account su `mytest.it`,
 * un dominio di terzi con l'MX attivo, cancellato il 27 set 2026. La RFC 6761
 * vieta di registrare `.test` (§6.2) ed `example.`, `example.com`,
 * `example.net`, `example.org` (§6.5), con i loro sottodomini.
 *
 * I file si prendono da `git ls-files`: un file nuovo non aggiunto all'indice
 * passa in locale e cade in CI, quindi si aggiunge prima di fidarsi del verde.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Un dominio che la RFC 6761 riserva, maiuscole comprese. */
function isReservedDomain(domain: string): boolean {
  return /(^|\.)(test|example|example\.com|example\.net|example\.org)$/i.test(domain)
}

/**
 * Le sole eccezioni, una per una e con il perché. Non sono indirizzi di prova:
 * sono testo dell'app che un test cerca per trovare un elemento.
 */
const ALLOWED_LITERALS = new Set([
  // Il placeholder del campo email a schermo (`AuthForm.tsx`): il test lo usa
  // come selettore, e cambiarlo qui vorrebbe dire cambiare l'app.
  'tua@email.com',
])

/**
 * Un indirizzo letterale, anche composto: `${id}@example.test` conta. Il
 * dominio si prende intero, con le lettere di ogni alfabeto: fermarsi alle
 * lettere ASCII lascerebbe solo `example.com` di un indirizzo che finisce in
 * `.中国`, o in un TLD in punycode, e quel prefisso è riservato mentre il
 * dominio non lo è (revisione di CodeRabbit sulla PR #245).
 */
const ADDRESS = /([A-Za-z0-9._%+}-]+)@([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)/gu

/** `react@18.3.1` è un pacchetto: un dominio vero finisce con un'etichetta che ha lettere. */
function endsWithLetters(domain: string): boolean {
  return /\p{L}/u.test(domain.slice(domain.lastIndexOf('.') + 1))
}

/** Gli indirizzi su un dominio registrabile, come `riga → indirizzo`. */
function unreservedAddresses(source: string): string[] {
  return source.split('\n').flatMap((line, index) =>
    [...line.matchAll(ADDRESS)]
      .filter(([address, , domain]) => endsWithLetters(domain) && !isReservedDomain(domain) && !ALLOWED_LITERALS.has(address))
      .map(([address]) => `${index + 1} → ${address}`)
  )
}

function scannedFiles(): string[] {
  return execFileSync('git', ['ls-files', 'scripts/**', 'tests/**', 'supabase/tests/**', '*.test.*', '*.spec.*'], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
}

describe('gli indirizzi di prova', () => {
  it('la scansione trova gli script e i test', () => {
    // Una lista vuota passerebbe sempre, ed è la forma peggiore di verde.
    expect(scannedFiles().length).toBeGreaterThan(150)
  })

  it('stanno tutti su un dominio che nessuno può registrare', () => {
    const offenders = scannedFiles().flatMap((file) =>
      unreservedAddresses(readFileSync(file, 'utf8')).map((hit) => `${file}:${hit}`)
    )
    expect(offenders).toEqual([])
  })
})

describe('il guardiano degli indirizzi', () => {
  // I domini da rifiutare si compongono, o questo file li conterrebbe.
  const outside = ['altro', 'dominio'].join('.')
  const lookalike = ['notexample', 'com'].join('.')
  const idn = '中国'
  const punycode = 'xn--fiqs8s'

  it.each(['a@example.test', 'b@sub.example.com', 'c@evil.example', 'd@EXAMPLE.TEST', "`${id}@example.test`"])(
    'accetta %s',
    (text) => {
      expect(unreservedAddresses(text)).toEqual([])
    }
  )

  it.each([`a@${outside}`, `\`\${id}@${outside}\``, `x@example.test.${outside}`, `y@${lookalike}`, `z@example.com.${idn}`, `w@example.test.${punycode}`, `v@${idn}.${idn}`])(
    'rifiuta %s',
    (text) => {
      expect(unreservedAddresses(text)).toHaveLength(1)
    }
  )

  it('lascia stare versioni e scope dei pacchetti', () => {
    expect(unreservedAddresses("import x from '@supabase/supabase-js'; npx react@18.3.1")).toEqual([])
  })
})
