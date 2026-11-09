/**
 * Il controllo settimanale di `npm audit` (#221), provato come **sottoprocesso**
 * con rapporti sintetici: il contratto comprende il codice di uscita, che è ciò
 * che il workflow guarda.
 *
 * **Rosso = qualcuno ha qualcosa da fare.** Non «ci sono vulnerabilità»: su
 * questo albero ce ne sono di già valutate, e un rosso permanente
 * insegnerebbe a ignorarlo. I modi di avere qualcosa da fare sono un caso
 * ciascuno, perché un guardiano che tace su uno di questi è indistinguibile da
 * un verde.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- lo script è JavaScript senza dichiarazioni, e qui i tipi non provano niente
import { compare, patchedVersions, report } from '../scripts/weekly-audit.mjs'

const SCRIPT = join(__dirname, '../scripts/weekly-audit.mjs')

interface Accepted {
  ghsa: string
  issue: number
  packageName: string
  /** Le versioni corrette dell'advisory, una per serie: `null` dove una serie non ne ha (#254). */
  patched: (string | null)[]
}

/**
 * Le voci accettate, lette **dal sorgente dello script**: due elenchi scritti a
 * mano nello stesso repo non proverebbero niente.
 */
function declaredAccepted(): Accepted[] {
  const source = readFileSync(SCRIPT, 'utf8')
  const start = source.indexOf('export const ACCEPTED')
  const block = source.slice(start, source.indexOf('\n}', start))
  const entry = /'(GHSA-[\w-]+)':\s*\{\s*issue:\s*(\d+),\s*package:\s*'([^']+)',\s*patched:\s*\[([^\]]*)\]/g
  return [...block.matchAll(entry)].map((m) => ({
    ghsa: m[1],
    issue: Number(m[2]),
    packageName: m[3],
    patched: m[4]
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v !== '')
      .map((v) => (v === 'null' ? null : v.slice(1, -1))),
  }))
}

/** Un rapporto nella forma osservata di `npm audit --json`. */
function auditWith(ghsa: string[]): string {
  return JSON.stringify({
    vulnerabilities: Object.fromEntries(
      ghsa.map((id, i) => [
        `package-${i}`,
        // La catena vera mescola stringhe (anelli) e oggetti (advisory).
        { severity: 'high', via: ['another-package', { url: `https://github.com/advisories/${id}` }] },
      ])
    ),
  })
}

/** Le advisory nella forma di `GET /advisories/{ghsa_id}` dell'API di GitHub. */
function advisoriesFile(entries: Accepted[]): string {
  const file = join(mkdtempSync(join(tmpdir(), 'weekly-audit-')), 'advisories.json')
  writeFileSync(
    file,
    JSON.stringify(
      entries.map((e) => ({
        ghsa_id: e.ghsa,
        vulnerabilities: e.patched.map((version) => ({
          package: { name: e.packageName },
          first_patched_version: version,
        })),
      }))
    )
  )
  return file
}

function run(stdin: string, args: string[] = []) {
  const outcome = spawnSync('node', [SCRIPT, ...args], { input: stdin, encoding: 'utf8' })
  return { code: outcome.status, out: outcome.stdout }
}

const accepted = declaredAccepted()
const all = accepted.map((a) => a.ghsa)
const unchanged = () => ['--advisories', advisoriesFile(accepted)]

describe('l’elenco delle accettate', () => {
  it('non è vuoto, e il test lo sa leggere', () => {
    expect(accepted.length).toBeGreaterThan(0)
  })

  it('ogni voce rimanda a una issue di questo repo, che è pubblico', () => {
    for (const { issue } of accepted) expect(issue).toBeGreaterThan(0)
  })

  it('ogni voce registra l’insieme delle versioni corrette, non una sola (#254)', () => {
    for (const { patched } of accepted) expect(patched.length).toBeGreaterThan(0)
  })
})

describe('niente da fare', () => {
  it('tutte le accettate ancora presenti, e le correzioni quelle di quando sono state valutate: verde', () => {
    const { code, out } = run(auditWith(all), unchanged())

    expect(out).toContain('::notice::Nessun cambiamento')
    for (const { ghsa, issue } of accepted) expect(out).toContain(`${ghsa}  → #${issue}`)
    expect(code).toBe(0)
  })
})

describe('qualcosa da fare', () => {
  it('una segnalazione non ancora valutata: rosso, e la nomina', () => {
    const { code, out } = run(auditWith([...all, 'GHSA-xxxx-yyyy-zzzz']), unchanged())

    expect(out).toContain('::error::Segnalazione non ancora valutata: GHSA-xxxx-yyyy-zzzz')
    expect(code).toBe(1)
  })

  it('una accettata che non compare più: rosso, e dice di toglierla dall’elenco', () => {
    const [gone, ...rest] = accepted
    const { code, out } = run(auditWith(rest.map((a) => a.ghsa)), unchanged())

    expect(out).toContain(`::error::${gone.ghsa} non compare più`)
    expect(out).toMatch(/va tolta da ACCEPTED/)
    expect(code).toBe(1)
  })

  // Sulle funzioni pure con un elenco sintetico, che lo script accetta per
  // parametro: una voce vera senza correzione può sparire dall'elenco, com'è
  // successo il 26 ott 2026 (#251), e questo caso non deve dipendere da lei.
  // Il collegamento con l'elenco vero lo prova il caso qui sotto.
  it('una accettata senza correzione che ora ne ha una: rosso, con la versione', () => {
    const synthetic = {
      'GHSA-aaaa-bbbb-cccc': { issue: 999, package: 'some-package', patched: [null], why: 'per il test' },
    }
    const versions = { 'GHSA-aaaa-bbbb-cccc': ['9.9.9'] }

    const { rows, exit } = report(compare(new Set(['GHSA-aaaa-bbbb-cccc']), versions, synthetic), versions, synthetic)

    expect(rows.join('\n')).toContain('::error::GHSA-aaaa-bbbb-cccc ha versioni corrette diverse')
    expect(rows.join('\n')).toContain('nuove: 9.9.9')
    expect(rows.join('\n')).toContain('#999')
    expect(exit).toBe(1)
  })

  it('una accettata la cui versione corretta è cambiata: rosso', () => {
    const target = accepted.find((a) => a.patched.some((v) => v !== null))
    expect(target).toBeDefined()
    const now = accepted.map((a) => (a === target ? { ...a, patched: ['6.99.0'] } : a))

    const { code, out } = run(auditWith(all), ['--advisories', advisoriesFile(now)])

    expect(out).toContain(`::error::${target!.ghsa} ha versioni corrette diverse`)
    expect(out).toContain('nuove: 6.99.0')
    expect(code).toBe(1)
  })
})

describe('input che non si capisce: si fallisce, non si tace', () => {
  it('stdin che non è JSON', () => {
    const { code, out } = run('npm ERR! network timeout', unchanged())

    expect(out).toContain('::error::Non ho saputo leggere')
    expect(code).toBe(1)
  })

  it('voci presenti ma nessun GHSA ricavabile: la forma del rapporto è cambiata', () => {
    const report = JSON.stringify({ vulnerabilities: { braces: { via: [{ link: 'altrove' }] } } })
    const { code, out } = run(report, unchanged())

    expect(out).toMatch(/::error::.*la forma dell'uscita di `npm audit --json` è cambiata/)
    expect(out).not.toMatch(/non compare più/)
    expect(code).toBe(1)
  })

  it('senza il file delle advisory le correzioni non sono state guardate: rosso', () => {
    const { code, out } = run(auditWith(all))

    expect(out).toMatch(/::error::.*--advisories/)
    expect(code).toBe(1)
  })

  it('un’accettata che nel file delle advisory non c’è: rosso, e non «nessuna correzione»', () => {
    const { code, out } = run(auditWith(all), ['--advisories', advisoriesFile(accepted.slice(1))])

    expect(out).toContain(`::error::${accepted[0].ghsa} manca nel file delle advisory`)
    expect(out).not.toMatch(/versioni corrette diverse/)
    expect(code).toBe(1)
  })

  it('un file delle advisory che non è JSON', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'weekly-audit-')), 'advisories.json')
    writeFileSync(file, '{"message":"API rate limit exceeded"')

    const { code, out } = run(auditWith(all), ['--advisories', file])

    expect(out).toMatch(/::error::Non ho saputo leggere il file delle advisory/)
    expect(code).toBe(1)
  })
})

/**
 * Un'advisory con più serie ha un elemento di `vulnerabilities` per serie, e la
 * versione corretta che riguarda noi può stare in uno qualunque (#254). Si
 * confronta l'insieme: un rosso anche per una serie che non usiamo è voluto,
 * perché una correzione nuova va guardata una volta.
 *
 * I JSON sono quelli veri di `GET /advisories/{ghsa_id}`, salvati il 9 nov
 * 2026 in `tests/fixtures/advisories/`.
 */
describe('advisory con più serie (#254)', () => {
  const fixture = (id: string) =>
    JSON.parse(readFileSync(join(__dirname, `fixtures/advisories/${id}.json`), 'utf8'))
  const RJ75 = 'GHSA-rj75-hqrm-r3gf'
  const FAST_URI = 'GHSA-333x-w4r6-6crp'
  const entry = (pkg: string, patched: (string | null)[]) => ({ issue: 999, package: pkg, patched, why: 'per il test' })

  function check(id: string, advisory: unknown, pkg: string, registered: (string | null)[]) {
    const synthetic = { [id]: entry(pkg, registered) }
    const versions = patchedVersions([advisory], synthetic)
    return report(compare(new Set([id]), versions, synthetic), versions, synthetic)
  }

  it('postcss-selector-parser registrata con il solo 7.1.6: rosso, e il messaggio nomina 6.1.5', () => {
    const { rows, exit } = check(RJ75, fixture(RJ75), 'postcss-selector-parser', ['7.1.6'])

    expect(rows.join('\n')).toContain(`::error::${RJ75} ha versioni corrette diverse`)
    expect(rows.join('\n')).toContain('nuove: 6.1.5')
    expect(exit).toBe(1)
  })

  it('registrata con tutte e due le serie: verde', () => {
    const { rows, exit } = check(RJ75, fixture(RJ75), 'postcss-selector-parser', ['7.1.6', '6.1.5'])

    expect(rows.join('\n')).toContain('::notice::Nessun cambiamento')
    expect(exit).toBe(0)
  })

  it('fast-uri (#251), tre serie registrate in un altro ordine: verde, l’ordine non conta', () => {
    const { rows, exit } = check(FAST_URI, fixture(FAST_URI), 'fast-uri', ['3.1.9', '4.2.3', '2.4.8'])

    expect(rows.join('\n')).not.toMatch(/versioni corrette diverse/)
    expect(exit).toBe(0)
  })

  it('una serie che perde la correzione: rosso, e il messaggio dice quale è sparita', () => {
    const advisory = fixture(RJ75)
    advisory.vulnerabilities[1].first_patched_version = null

    const { rows, exit } = check(RJ75, advisory, 'postcss-selector-parser', ['7.1.6', '6.1.5'])

    expect(rows.join('\n')).toContain('sparite: 6.1.5')
    expect(rows.join('\n')).toContain('nuove: nessuna')
    expect(exit).toBe(1)
  })

  it('un’advisory che non ha elementi per il pacchetto: errore, come prima', () => {
    expect(() =>
      patchedVersions([fixture(RJ75)], { [RJ75]: entry('un-altro-pacchetto', ['7.1.6']) })
    ).toThrow(/non nomina `un-altro-pacchetto`/)
  })
})

describe('--accepted', () => {
  it('stampa gli identificatori, uno per riga: è ciò che il workflow chiede a GitHub', () => {
    const { code, out } = run('', ['--accepted'])

    expect(out.trim().split('\n')).toEqual(all)
    expect(code).toBe(0)
  })
})
