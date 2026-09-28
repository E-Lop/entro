/**
 * I due controlli puri del pre-push (#188): il confronto delle impronte e le
 * migrazioni mancanti in produzione.
 *
 * Tutti e due nominano oggetti e versioni, mai i valori: un'impronta contiene
 * ACL e corpi di funzione, e l'output del comando finisce nel terminale.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareFingerprints, parseQueryRows, type FingerprintRow } from '../scripts/prepush/fingerprint.ts'
import { checkMigrations, migrationVersion } from '../scripts/prepush/migrations.ts'

const row = (kind: string, name: string, value: string): FingerprintRow => ({ kind, name, value })

describe('compareFingerprints', () => {
  const source = [
    row('policy', 'storage.objects.Users can view own images', 'v1'),
    row('trigger', 'auth.users.on_auth_user_created', 't1'),
    row('function', 'public.get_user_list_ids()', 'f1'),
  ]

  it('due impronte uguali, in qualunque ordine, non danno differenze', () => {
    expect(compareFingerprints(source, [...source].reverse())).toEqual([])
  })

  it('nomina ciò che manca nello stack ombra', () => {
    expect(compareFingerprints(source, source.slice(1))).toEqual([
      'mancante nello stack ombra: policy storage.objects.Users can view own images',
    ])
  })

  it('nomina ciò che lo stack ombra ha in più', () => {
    expect(compareFingerprints(source, [...source, row('bucket', 'avatars', 'b')])).toEqual([
      'in più nello stack ombra: bucket avatars',
    ])
  })

  it('nomina ciò che è diverso, senza stamparne il valore', () => {
    const shadow = [source[0], source[1], row('function', 'public.get_user_list_ids()', 'SEGRETO')]
    const differences = compareFingerprints(source, shadow)
    expect(differences).toEqual(['diverso: function public.get_user_list_ids()'])
    expect(differences.join('\n')).not.toContain('SEGRETO')
    expect(differences.join('\n')).not.toContain('f1')
  })

  it('un nome ripetuto nella stessa impronta è un errore della query, non una differenza', () => {
    expect(() => compareFingerprints([...source, source[0]], source)).toThrow(/ripetut/)
  })
})

describe('parseQueryRows', () => {
  it('legge l’array di righe di `db query --agent no --output-format json`', () => {
    expect(parseQueryRows('[{"kind":"policy","name":"x","value":"v"}]')).toEqual([{ kind: 'policy', name: 'x', value: 'v' }])
  })

  it('legge anche la busta della modalità agente', () => {
    expect(parseQueryRows('{"boundary":"b","rows":[{"a":1}],"warning":"w"}')).toEqual([{ a: 1 }])
  })

  it('un errore della CLI diventa un errore, senza riportarne il messaggio', () => {
    const stdout = '{"_tag":"Error","error":{"code":"DbQueryExecError","message":"password authentication failed for user postgres.abc"}}'
    expect(() => parseQueryRows(stdout)).toThrow(/DbQueryExecError/)
    expect(() => parseQueryRows(stdout)).not.toThrow(/password/)
  })

  it('un output che non è JSON è un errore', () => {
    expect(() => parseQueryRows('Connecting to local database...')).toThrow()
  })
})

describe('migrationVersion', () => {
  it('è il prefisso numerico del nome del file', () => {
    expect(migrationVersion('supabase/migrations/20260927090000_rls_helpers_qualified_names.sql')).toBe('20260927090000')
    expect(migrationVersion('20260818_default_list_trigger.sql')).toBe('20260818')
  })
})

describe('checkMigrations', () => {
  const repo = ['20260101', '20260201', '20260301']

  it('passa se in produzione mancano esattamente le migrazioni del ramo', () => {
    expect(checkMigrations({ repo, applied: ['20260101', '20260201'], branch: ['20260301'] })).toEqual([])
  })

  it('si ferma se il ramo non aggiunge migrazioni', () => {
    expect(checkMigrations({ repo: repo.slice(0, 2), applied: repo.slice(0, 2), branch: [] })).toEqual([
      'il ramo non aggiunge migrazioni rispetto a origin/main',
    ])
  })

  it('si ferma, e la nomina, se in produzione manca una migrazione che non è del ramo', () => {
    // Il 22 set 2026 mancava in produzione una migrazione di agosto: il push
    // l'avrebbe applicata insieme a quella nuova, senza che nessuno lo decidesse.
    expect(checkMigrations({ repo, applied: ['20260101'], branch: ['20260301'] })).toEqual([
      'in produzione manca 20260201, che non è di questo ramo',
    ])
  })

  it('si ferma se in produzione c’è una migrazione che nel repo non esiste', () => {
    expect(checkMigrations({ repo, applied: ['20260101', '20260201', '20260150'], branch: ['20260301'] })).toEqual([
      'in produzione c’è 20260150, che nel repo non esiste',
    ])
  })

  it('si ferma se una migrazione del ramo è già in produzione', () => {
    expect(checkMigrations({ repo, applied: repo, branch: ['20260301'] })).toEqual([
      '20260301, del ramo, è già in produzione: dopo il push un file di migrazione non si tocca',
    ])
  })
})

describe('db-prepush.sh', () => {
  // Letto come testo: il comando ferma lo stack di sviluppo, e qui si
  // controllano solo le due regole che, violate, toccano dati veri.
  const script = readFileSync(join(__dirname, '..', 'scripts', 'prepush', 'db-prepush.sh'), 'utf8')
  const commands = script.split('\n').filter((line) => !line.trimStart().startsWith('#'))

  it('non usa mai --no-backup, che cancella i volumi del progetto', () => {
    expect(commands.filter((line) => line.includes('--no-backup'))).toEqual([])
  })

  it('ogni chiamata a db o test db dice su quale database, perché il default è la produzione', () => {
    const calls = commands.filter((line) => /supabase (db|test db) /.test(line) && !/^\s*echo /.test(line))
    expect(calls.length).toBeGreaterThanOrEqual(5)
    const implicit = calls.filter((line) => !/--local|--linked|"\$SOURCE_FLAG"|"\$@"/.test(line))
    expect(implicit).toEqual([])
  })
})
