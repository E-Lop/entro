/**
 * Il controllo settimanale di `npm audit` (#221), provato come **sottoprocesso**
 * con rapporti sintetici: il contratto comprende il codice di uscita, che è ciò
 * che il workflow guarda.
 *
 * **Rosso = qualcuno ha qualcosa da fare.** Non «ci sono vulnerabilità»: su
 * questo albero ce ne sono due, già valutate nella #222, e un rosso permanente
 * insegnerebbe a ignorarlo. I modi di avere qualcosa da fare sono un caso
 * ciascuno, perché un guardiano che tace su uno di questi è indistinguibile da
 * un verde.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SCRIPT = join(__dirname, '../scripts/weekly-audit.mjs')

interface Accepted {
  ghsa: string
  issue: number
  packageName: string
  patched: string | null
}

/**
 * Le voci accettate, lette **dal sorgente dello script**: due elenchi scritti a
 * mano nello stesso repo non proverebbero niente.
 */
function declaredAccepted(): Accepted[] {
  const source = readFileSync(SCRIPT, 'utf8')
  const start = source.indexOf('export const ACCEPTED')
  const block = source.slice(start, source.indexOf('\n}', start))
  const entry = /'(GHSA-[\w-]+)':\s*\{\s*issue:\s*(\d+),\s*package:\s*'([^']+)',\s*patched:\s*(null|'[^']+')/g
  return [...block.matchAll(entry)].map((m) => ({
    ghsa: m[1],
    issue: Number(m[2]),
    packageName: m[3],
    patched: m[4] === 'null' ? null : m[4].slice(1, -1),
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
        vulnerabilities: [{ package: { name: e.packageName }, first_patched_version: e.patched }],
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

  it('una accettata senza correzione che ora ne ha una: rosso, con la versione', () => {
    const target = accepted.find((a) => a.patched === null)
    expect(target).toBeDefined()
    const now = accepted.map((a) => (a === target ? { ...a, patched: '9.9.9' } : a))

    const { code, out } = run(auditWith(all), ['--advisories', advisoriesFile(now)])

    expect(out).toContain(`::error::${target!.ghsa} ha ora una versione corretta: 9.9.9`)
    expect(out).toContain(`#${target!.issue}`)
    expect(code).toBe(1)
  })

  it('una accettata la cui versione corretta è cambiata: rosso', () => {
    const target = accepted.find((a) => a.patched !== null)
    expect(target).toBeDefined()
    const now = accepted.map((a) => (a === target ? { ...a, patched: '6.99.0' } : a))

    const { code, out } = run(auditWith(all), ['--advisories', advisoriesFile(now)])

    expect(out).toContain(`::error::${target!.ghsa} ha ora una versione corretta: 6.99.0`)
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
    expect(out).not.toMatch(/ha ora una versione corretta/)
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

describe('--accepted', () => {
  it('stampa gli identificatori, uno per riga: è ciò che il workflow chiede a GitHub', () => {
    const { code, out } = run('', ['--accepted'])

    expect(out.trim().split('\n')).toEqual(all)
    expect(code).toBe(0)
  })
})
