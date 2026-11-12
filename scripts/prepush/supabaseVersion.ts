/**
 * La versione della CLI di Supabase che il pre-push sa usare (#266).
 *
 * Le letture passano `db query --read-only`, che c'è dalla v3: senza, una
 * query su un progetto ospitato chiede conferma, e con l'uscita JSON non può
 * chiederla. La v4 toglie `--linked` e `--local`, che lo script usa ancora.
 */
const SEMVER = /^(\d+)\.\d+\.\d+$/

/** `true` solo per una versione `3.x.y`; qualunque altra cosa ferma il comando. */
export function isSupportedSupabaseVersion(output: string): boolean {
  const match = SEMVER.exec(output.trim())
  return match !== null && Number(match[1]) === 3
}
