/**
 * I passi del pre-push che non sono comandi della CLI di Supabase (#188).
 * Li chiama `db-prepush.sh`; stampa solo nomi di oggetti e versioni.
 *
 *   node scripts/prepush/commands.ts migrations <applied.json> <branch-files.txt>
 *   node scripts/prepush/commands.ts compare <source.json> <shadow.json>
 *   node scripts/prepush/commands.ts column <rows.json> <colonna>
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { compareFingerprints, parseQueryRows, type FingerprintRow } from './fingerprint.ts'
import { checkMigrations, migrationVersion } from './migrations.ts'

const [command, first, second] = process.argv.slice(2)
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
} else {
  console.error('uso: commands.ts migrations|compare|column …')
  process.exitCode = 2
}
