/**
 * Il nome dei progetti locali della CLI di Supabase e la configurazione dello
 * stack ombra (#258).
 *
 * La CLI chiama container e volumi `supabase_<servizio>_<project_id>`, dove
 * `project_id` è la chiave in testa a `supabase/config.toml` o, se manca, il
 * nome della cartella; in tutti e due i casi passa da `sanitizeProjectId`
 * (`apps/cli-go/pkg/config/config.go`, tag v2.122.0; la v3 tiene la regola).
 */

// La chiave fuori da ogni tabella: un `project_id` dentro `[remotes.<nome>]` è
// il ref di un progetto ospitato, non il nome dei container.
const PROJECT_ID_KEY = /^\s*(?:project_id|"project_id"|'project_id')\s*=/
const PROJECT_ID_LINE = /^\s*(?:project_id|"project_id"|'project_id')\s*=\s*(?:"([^"\\]*)"|'([^']*)')\s*(?:#.*)?$/
const TABLE_HEADER = /^\s*\[/

/** Le righe in testa al file, prima della prima tabella. */
function topLevelLines(toml: string): string[] {
  const lines = toml.split('\n')
  const firstTable = lines.findIndex((line) => TABLE_HEADER.test(line))
  return firstTable === -1 ? lines : lines.slice(0, firstTable)
}

/**
 * Il `project_id` in testa al file, se c'è. Un valore che non è una stringa
 * semplice fra virgolette ferma il comando: indovinarlo vorrebbe dire puntare
 * a container che non sono quelli di sviluppo.
 */
export function topLevelProjectId(toml: string): string | undefined {
  const line = topLevelLines(toml).find((candidate) => PROJECT_ID_KEY.test(candidate))
  if (line === undefined) return undefined
  const match = PROJECT_ID_LINE.exec(line)
  if (!match) throw new Error('project_id in supabase/config.toml non leggibile: serve una stringa fra virgolette')
  return match[1] ?? match[2]
}

const MAX_PROJECT_ID_LENGTH = 40

/** `sanitizeProjectId` della CLI. */
function sanitizeProjectId(source: string): string {
  return source
    .replace(/[^a-zA-Z0-9_.-]+/g, '_')
    .replace(/^[_.-]+/, '')
    .slice(0, MAX_PROJECT_ID_LENGTH)
}

/** Il nome che la CLI dà al progetto locale di questa cartella. */
export function localProjectId(toml: string, folder: string): string {
  return sanitizeProjectId(topLevelProjectId(toml) ?? folder)
}

/**
 * La configurazione dello stack ombra: il suo `project_id`, la versione di
 * Postgres della sorgente e il resto del file vero, senza il `project_id` in
 * testa. TOML non ammette una chiave ripetuta, e la CLI v3 si ferma su una
 * configurazione non valida. Le altre righe in testa al file restano prima di
 * `[db]`: dopo, una chiave in testa diventerebbe una chiave di `[db]`.
 */
export function shadowConfig(toml: string, projectId: string, major: string): string {
  const top = topLevelLines(toml)
  const tables = toml.split('\n').slice(top.length)
  return [
    `project_id = "${projectId}"`,
    ...top.filter((line) => !PROJECT_ID_KEY.test(line)),
    '[db]',
    `major_version = ${major}`,
    '',
    ...tables,
  ].join('\n')
}
