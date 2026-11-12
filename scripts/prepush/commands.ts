/**
 * I passi del pre-push che non sono comandi della CLI di Supabase (#188).
 * Li chiama `db-prepush.sh`; stampa solo nomi di oggetti e versioni.
 *
 *   node scripts/prepush/commands.ts migrations <applied.json> <branch-files.txt>
 *   node scripts/prepush/commands.ts compare <source.json> <shadow.json>
 *   node scripts/prepush/commands.ts column <rows.json> <colonna>
 *   node scripts/prepush/commands.ts project-id <config.toml> <cartella>
 *   node scripts/prepush/commands.ts shadow-config <config.toml> <project_id> <major>
 *   node scripts/prepush/commands.ts supabase-version <uscita di supabase --version>
 *   node scripts/prepush/commands.ts project-config <config.toml> <project_id>
 *   node scripts/prepush/commands.ts drift <diff.sql> <declared-drift.json> <linked|local>
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { compareFingerprints, parseQueryRows, type FingerprintRow } from './fingerprint.ts'
import { checkMigrations, migrationVersion } from './migrations.ts'
import { isSupportedSupabaseVersion } from './supabaseVersion.ts'
import { checkDrift, parseDeclaredDrift, splitStatements } from './drift.ts'
import { localProjectId, shadowConfig, withProjectId } from './projectConfig.ts'

const [command, first, second, third] = process.argv.slice(2)
const rows = (path: string) => parseQueryRows(readFileSync(path, 'utf8'))

function report(problems: string[]): void {
  for (const problem of problems) console.log(`  - ${problem}`)
  process.exitCode = problems.length > 0 ? 1 : 0
}

if (command === 'migrations') {
  const repo = readdirSync(join(process.cwd(), 'supabase', 'migrations'))
    .filter((file) => file.endsWith('.sql'))
    .map(migrationVersion)
  const applied = rows(first).map((row) => String(row.version))
  const branch = readFileSync(second, 'utf8').split('\n').filter(Boolean).map(migrationVersion)
  report(checkMigrations({ repo, applied, branch }))
} else if (command === 'compare') {
  report(compareFingerprints(rows(first) as unknown as FingerprintRow[], rows(second) as unknown as FingerprintRow[]))
} else if (command === 'column') {
  for (const row of rows(first)) console.log(String(row[second]))
} else if (command === 'project-id') {
  console.log(localProjectId(readFileSync(first, 'utf8'), second))
} else if (command === 'shadow-config') {
  process.stdout.write(shadowConfig(readFileSync(first, 'utf8'), second, third))
} else if (command === 'project-config') {
  process.stdout.write(withProjectId(readFileSync(first, 'utf8'), second))
} else if (command === 'drift') {
  const result = checkDrift(splitStatements(readFileSync(first, 'utf8')), parseDeclaredDrift(readFileSync(second, 'utf8')))
  if (result.undeclared.length > 0) {
    console.log('differenze non dichiarate:')
    report(result.undeclared)
  }
  console.log(`derive dichiarate trovate: ${result.matched.join(', ') || 'nessuna'}`)
  // In locale le derive dell'ambiente non ci sono: la voce vecchia si vede
  // solo contro la produzione.
  if (third === 'linked' && result.stale.length > 0) {
    console.log(`⚠️ dichiarate ma non più nel diff: ${result.stale.join(', ')}. Se non servono più, vanno tolte da declared-drift.json`)
  }
  process.exitCode = result.undeclared.length > 0 ? 1 : 0
} else if (command === 'supabase-version') {
  process.exitCode = isSupportedSupabaseVersion(first ?? '') ? 0 : 1
} else {
  console.error('uso: commands.ts migrations|compare|column|project-id|shadow-config|supabase-version|project-config|drift …')
  process.exitCode = 2
}
