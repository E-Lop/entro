/**
 * I workflow che fanno girare la suite di smoke contro la produzione (#190).
 *
 * La sintassi la controlla `actionlint`; qui si controllano le regole del
 * brief che si leggono dal file:
 * - i secret vengono solo dall'Environment `production`, legato a `main`, e
 *   nessun workflow che li legge parte da una pull request;
 * - le corse contro la produzione sono serializzate fra loro, in un gruppo solo;
 * - un secret sta nell'`env` del passo che lo usa, mai in quello del job o del
 *   workflow, dove lo vedrebbero anche `npm ci` e gli script d'installazione
 *   delle dipendenze;
 * - i giri pianificati avvisano Healthchecks; senza secret si fermano dicendolo.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const WORKFLOWS = {
  hourly: '.github/workflows/smoke-hourly.yml',
  daily: '.github/workflows/smoke-daily.yml',
  deploy: '.github/workflows/smoke-deploy.yml',
} as const

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}

/** Le righe che non sono commenti. */
function code(source: string): string[] {
  return source.split('\n').filter((line) => !line.trimStart().startsWith('#'))
}

describe.each(Object.entries(WORKFLOWS))('il workflow %s', (_, path) => {
  const source = read(path)
  const lines = code(source)

  it("legge i secret dal solo Environment production, nel job serializzato con gli altri giri", () => {
    expect(lines.some((line) => /^ {4}environment: production$/.test(line))).toBe(true)
    expect(source).toMatch(/\n {4}concurrency:\n {6}group: smoke-production\n {6}cancel-in-progress: false\n/)
  })

  it('non parte da una pull request', () => {
    expect(lines.join('\n')).not.toMatch(/pull_request/)
  })

  it("ogni secret sta nell'env di un passo, non in quello del job o del workflow", () => {
    const withSecrets = lines.filter((line) => /\$\{\{\s*secrets\./.test(line))
    expect(withSecrets.length).toBeGreaterThan(0)
    for (const line of withSecrets) {
      // workflow `env:` a 2 spazi, job `env:` a 6, `env:` di un passo a 10.
      expect(line.match(/^ */)?.[0].length, line.trim()).toBeGreaterThanOrEqual(10)
    }
  })

  it('controlla i secret prima di installare qualunque cosa', () => {
    const steps = lines.join('\n')
    const check = steps.indexOf('scripts/smoke/require-secrets.sh')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(steps.indexOf('run: npm ci'))
  })

  it('non carica artefatti', () => {
    expect(source).not.toContain('upload-artifact')
  })
})

describe('i giri pianificati', () => {
  it('ogni ora al minuto 17: livello a, avvolto dai segnali a Healthchecks', () => {
    const source = read(WORKFLOWS.hourly)
    expect(source).toContain("- cron: '17 * * * *'")
    expect(source).toContain('secrets.HEALTHCHECKS_HOURLY_URL')
    expect(source).toMatch(/node scripts\/smoke\/healthchecks\.mjs 'SMOKE_LEVELS=a npm run smoke'/)
  })

  it('una volta al giorno: ripristino, poi la suite nel browser su entroapp.it, avvolti dai segnali', () => {
    const source = read(WORKFLOWS.daily)
    expect(source).toMatch(/- cron: '\d+ \d+ \* \* \*'/)
    expect(source).toContain('secrets.HEALTHCHECKS_DAILY_URL')
    expect(source).toMatch(/node scripts\/smoke\/healthchecks\.mjs 'npm run smoke:restore && npm run smoke:browser'/)
    expect(source).toContain('SMOKE_SITE_URL: https://entroapp.it')
  })

  it('il giro giornaliero sta lontano dalla mezzanotte di Roma: ripristino e controllo nello stesso giorno', () => {
    const [, hour] = read(WORKFLOWS.daily).match(/- cron: '\d+ (\d+) \* \* \*'/) ?? []
    // Roma è UTC+1 o UTC+2: fra le 3 e le 20 UTC la mezzanotte è lontana ore.
    expect(Number(hour)).toBeGreaterThanOrEqual(3)
    expect(Number(hour)).toBeLessThanOrEqual(20)
  })
})

describe('il giro dopo il deploy e dopo il push dello schema', () => {
  const source = read(WORKFLOWS.deploy)

  it('parte a ogni push su main, e a mano', () => {
    expect(source).toMatch(/\non:\n {2}push:\n {4}branches: \[main\]\n {2}workflow_dispatch:\n/)
  })

  it('al push aspetta che il sito serva lo SHA del commit, al lancio a mano no', () => {
    expect(source).toContain('node scripts/smoke/wait-for-deploy.mjs')
    expect(source).toContain('EXPECTED_SHA: ${{ github.sha }}')
    expect(source).toContain("if: github.event_name == 'push'")
  })

  it('ripristino, livelli a, b e c, ripristino, poi il browser, in quest’ordine', () => {
    const steps = [
      'run: npm run smoke:restore',
      'SMOKE_LEVELS: a,b,c',
      'run: npm run smoke:restore',
      'run: npm run smoke:browser',
    ]
    let from = 0
    for (const step of steps) {
      const at = source.indexOf(step, from)
      expect(at, step).toBeGreaterThan(-1)
      from = at + step.length
    }
  })
})

describe('require-secrets.sh', () => {
  function run(env: Record<string, string>, names: string[]) {
    const dir = mkdtempSync(join(tmpdir(), 'entro-require-secrets-'))
    const output = join(dir, 'output')
    const summary = join(dir, 'summary')
    const result = spawnSync('bash', ['scripts/smoke/require-secrets.sh', ...names], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...env },
    })
    const read = (file: string) => {
      try {
        return readFileSync(file, 'utf8')
      } catch {
        return ''
      }
    }
    return { status: result.status, log: result.stdout + result.stderr, output: read(output), summary: read(summary) }
  }

  it('con tutti i secret dice ready=true e non stampa i valori', () => {
    const result = run({ SMOKE_A_EMAIL: 'valore-segreto-1', HEALTHCHECKS_URL: 'valore-segreto-2' }, ['SMOKE_A_EMAIL', 'HEALTHCHECKS_URL'])

    expect(result.status).toBe(0)
    expect(result.output).toBe('ready=true\n')
    expect(result.log + result.summary).not.toContain('valore-segreto')
  })

  it('senza secret si ferma verde, dicendo quali mancano e dove si creano', () => {
    const result = run({ SMOKE_A_EMAIL: 'valore-segreto-1', HEALTHCHECKS_URL: '' }, ['SMOKE_A_EMAIL', 'HEALTHCHECKS_URL', 'SMOKE_B_EMAIL'])

    expect(result.status).toBe(0)
    expect(result.output).toBe('ready=false\n')
    expect(result.log).toMatch(/^::notice /m)
    for (const text of [result.log, result.summary]) {
      expect(text).toContain('HEALTHCHECKS_URL')
      expect(text).toContain('SMOKE_B_EMAIL')
      expect(text).not.toContain('SMOKE_A_EMAIL')
      expect(text).toContain('#189')
    }
    expect(result.log + result.summary).not.toContain('valore-segreto')
  })

  it('senza nomi è un errore di chi scrive il workflow', () => {
    expect(run({}, []).status).not.toBe(0)
  })
})
