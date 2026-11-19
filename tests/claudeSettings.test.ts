/**
 * Le impostazioni di progetto di Claude Code tracciate in git valgono per
 * chiunque cloni entro, che è pubblico (#263).
 *
 * Due regole, decise il 19 nov 2026:
 * - nessuna regola `allow` nel file tracciato. La skill di Modern Web Guidance
 *   chiede di consentire `npx -y modern-web-guidance@latest *`: tracciata,
 *   quella regola farebbe partire senza conferma l'ultima versione pubblicata
 *   su ogni macchina senza `min-release-age`, anche se uscita da poche ore. Le
 *   regole `allow` stanno in `.claude/settings.local.json`, ignorato da git;
 * - con il plugin abilitato, la telemetria è spenta. La CLI manda a Google le
 *   query di ricerca, che descrivono il codice, attraverso un processo staccato
 *   che sopravvive alla CLI. Si spegne solo con `DISABLE_TELEMETRY` uguale a
 *   `1` o `true`, maiuscole indifferenti: letto nel codice della 1.0.0.
 *
 * I file si prendono da `git ls-files`: conta ciò che finisce nel repo, non
 * ciò che sta sul disco di chi lancia i test.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const TRACKED_SETTINGS = '.claude/settings.json'
const LOCAL_SETTINGS = '.claude/settings.local.json'
const MODERN_WEB_GUIDANCE = 'modern-web-guidance@claude-plugins-official'

interface ClaudeSettings {
  permissions?: { allow?: unknown[] }
  enabledPlugins?: Record<string, boolean>
  env?: Record<string, string>
}

/** I valori con cui la CLI di Modern Web Guidance spegne la telemetria. */
function disablesTelemetry(value: string | undefined): boolean {
  const normalized = value?.toLowerCase()
  return normalized === '1' || normalized === 'true'
}

/** Ciò che nel file tracciato viola una delle due regole, in italiano. */
function trackedSettingsProblems(settings: ClaudeSettings): string[] {
  const problems: string[] = []
  if ((settings.permissions?.allow?.length ?? 0) > 0) {
    problems.push(`regole allow nel file tracciato: vanno in ${LOCAL_SETTINGS}`)
  }
  if (settings.enabledPlugins?.[MODERN_WEB_GUIDANCE] === true && !disablesTelemetry(settings.env?.DISABLE_TELEMETRY)) {
    problems.push('Modern Web Guidance abilitato con la telemetria accesa: manca DISABLE_TELEMETRY=1 in env')
  }
  return problems
}

function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
}

describe('trackedSettingsProblems', () => {
  it.each<[string, ClaudeSettings]>([
    ['una regola allow', { permissions: { allow: ['Bash(npx -y modern-web-guidance@latest *)'] } }],
    ['il plugin senza env', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true } }],
    ['il plugin con DISABLE_TELEMETRY=0', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true }, env: { DISABLE_TELEMETRY: '0' } }],
    ['il plugin con DISABLE_TELEMETRY vuota', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true }, env: { DISABLE_TELEMETRY: '' } }],
    ['il plugin con DISABLE_TELEMETRY=yes', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true }, env: { DISABLE_TELEMETRY: 'yes' } }],
  ])('rifiuta %s', (_, settings) => {
    expect(trackedSettingsProblems(settings)).toHaveLength(1)
  })

  it.each<[string, ClaudeSettings]>([
    ['il plugin con DISABLE_TELEMETRY=1', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true }, env: { DISABLE_TELEMETRY: '1' } }],
    ['il plugin con DISABLE_TELEMETRY=TRUE', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: true }, env: { DISABLE_TELEMETRY: 'TRUE' } }],
    ['il plugin disabilitato senza env', { enabledPlugins: { [MODERN_WEB_GUIDANCE]: false } }],
    ['una lista allow vuota', { permissions: { allow: [] } }],
    ['un file vuoto', {}],
  ])('accetta %s', (_, settings) => {
    expect(trackedSettingsProblems(settings)).toEqual([])
  })
})

describe('impostazioni di progetto di Claude Code nel repo', () => {
  const files = trackedFiles()

  it('le impostazioni locali non sono tracciate', () => {
    expect(files).not.toContain(LOCAL_SETTINGS)
  })

  it('il file tracciato rispetta le due regole', () => {
    expect(files).toContain(TRACKED_SETTINGS)
    const settings = JSON.parse(readFileSync(TRACKED_SETTINGS, 'utf8')) as ClaudeSettings
    expect(trackedSettingsProblems(settings)).toEqual([])
  })
})
