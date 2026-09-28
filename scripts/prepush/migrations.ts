/**
 * Quali migrazioni mancano in produzione, e se sono proprio quelle del ramo
 * (#188).
 *
 * `db push` applica tutto ciò che manca: il 22 set 2026 in produzione mancava
 * anche una migrazione di agosto, e il push l'avrebbe portata insieme a quella
 * nuova senza che nessuno lo decidesse.
 */

/** La versione di una migrazione: il prefisso numerico del nome del file. */
export function migrationVersion(path: string): string {
  const file = path.split('/').pop() ?? path
  const match = file.match(/^(\d+)_/)
  if (!match) throw new Error(`nome di migrazione senza versione: ${file}`)
  return match[1]
}

export interface MigrationState {
  /** Le versioni in `supabase/migrations/` del ramo. */
  repo: readonly string[]
  /** Le versioni in `supabase_migrations.schema_migrations` della sorgente. */
  applied: readonly string[]
  /** Le versioni che il ramo aggiunge rispetto a `origin/main`. */
  branch: readonly string[]
}

/** I motivi per fermarsi: vuoto se mancano esattamente le migrazioni del ramo. */
export function checkMigrations({ repo, applied, branch }: MigrationState): string[] {
  const problems: string[] = []
  if (branch.length === 0) return ['il ramo non aggiunge migrazioni rispetto a origin/main']

  const appliedSet = new Set(applied)
  const branchSet = new Set(branch)
  const repoSet = new Set(repo)

  for (const version of branch) {
    if (appliedSet.has(version)) {
      problems.push(`${version}, del ramo, è già in produzione: dopo il push un file di migrazione non si tocca`)
    }
  }
  for (const version of repo) {
    if (!appliedSet.has(version) && !branchSet.has(version)) {
      problems.push(`in produzione manca ${version}, che non è di questo ramo`)
    }
  }
  for (const version of applied) {
    if (!repoSet.has(version)) problems.push(`in produzione c’è ${version}, che nel repo non esiste`)
  }
  return problems
}
