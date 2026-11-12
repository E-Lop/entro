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
import { isSupportedSupabaseVersion } from '../scripts/prepush/supabaseVersion.ts'
import { localProjectId, shadowConfig, topLevelProjectId } from '../scripts/prepush/projectConfig.ts'

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

// Il `config.toml` di entro oggi non ha un `project_id`; la guida della CLI v3
// propone di aggiungerlo a chi non ritrova i dati dopo l'aggiornamento (#258).
const functionsOnly = '# Edge Functions\n\n[functions.create-invite]\nverify_jwt = false\n'
const withProjectId = `project_id = "entro"\n\n${functionsOnly}`

describe('topLevelProjectId', () => {
  it('non c’è se il file non lo dichiara', () => {
    expect(topLevelProjectId(functionsOnly)).toBeUndefined()
  })

  it('legge il valore fra virgolette doppie o semplici, anche con un commento dopo', () => {
    expect(topLevelProjectId(withProjectId)).toBe('entro')
    expect(topLevelProjectId("project_id = 'entro' # nome dei container\n")).toBe('entro')
  })

  it('ignora il project_id dentro una tabella, che è il ref di un progetto ospitato', () => {
    expect(topLevelProjectId(`${functionsOnly}\n[remotes.staging]\nproject_id = "abcdefghijklmnopqrst"\n`)).toBeUndefined()
  })

  it('si ferma su un valore che non sa leggere, invece di indovinare il nome dei container', () => {
    expect(() => topLevelProjectId('project_id = entro\n')).toThrow(/project_id/)
  })
})

describe('localProjectId', () => {
  // La regola della CLI: il project_id del file, altrimenti il nome della
  // cartella, ripulito da sanitizeProjectId (pkg/config/config.go, v2.122.0).
  it('senza project_id è il nome della cartella', () => {
    expect(localProjectId(functionsOnly, 'entro')).toBe('entro')
  })

  it('con un project_id è quello, qualunque sia la cartella', () => {
    expect(localProjectId(withProjectId, 'entro-wt-258')).toBe('entro')
  })

  it('ripulisce il nome come la CLI: caratteri non ammessi, iniziali e lunghezza', () => {
    expect(localProjectId(functionsOnly, 'il mio progetto!')).toBe('il_mio_progetto_')
    expect(localProjectId(functionsOnly, '_.-entro')).toBe('entro')
    expect(localProjectId(functionsOnly, 'a'.repeat(45))).toBe('a'.repeat(40))
  })
})

describe('shadowConfig', () => {
  const projectIds = (toml: string) => toml.split('\n').filter((line) => /^\s*project_id\s*=/.test(line))

  it('ha un solo project_id, quello dell’ombra, anche se il file vero ne dichiara uno', () => {
    for (const source of [functionsOnly, withProjectId]) {
      const shadow = shadowConfig(source, 'entro-prodshape', '17')
      expect(projectIds(shadow)).toEqual(['project_id = "entro-prodshape"'])
      expect(topLevelProjectId(shadow)).toBe('entro-prodshape')
    }
  })

  it('porta la versione di Postgres della sorgente e il resto del file così com’è', () => {
    const shadow = shadowConfig(withProjectId, 'entro-prodshape', '17')
    expect(shadow).toContain('[db]\nmajor_version = 17\n')
    expect(shadow).toContain('[functions.create-invite]\nverify_jwt = false\n')
  })

  it('una chiave in testa al file vero resta in testa, non finisce dentro [db]', () => {
    const shadow = shadowConfig(`project_id = "entro"\nfoo = 1\n\n[functions.x]\nverify_jwt = false\n`, 'entro-prodshape', '17')
    expect(shadow.indexOf('foo = 1')).toBeLessThan(shadow.indexOf('[db]'))
  })

  it('non tocca il project_id di una tabella [remotes]', () => {
    const source = `${withProjectId}\n[remotes.staging]\nproject_id = "abcdefghijklmnopqrst"\n`
    expect(shadowConfig(source, 'entro-prodshape', '17')).toContain('[remotes.staging]\nproject_id = "abcdefghijklmnopqrst"\n')
  })
})

// #266: le letture del pre-push passano `--read-only`, che c'è dalla v3; la v4
// toglie `--linked` e `--local`, che lo script usa ancora.
describe('isSupportedSupabaseVersion', () => {
  it('accetta la v3', () => {
    expect(isSupportedSupabaseVersion('3.0.0')).toBe(true)
    expect(isSupportedSupabaseVersion('3.1.0\n')).toBe(true)
  })

  it('ferma la v2 e la v4', () => {
    expect(isSupportedSupabaseVersion('2.122.0')).toBe(false)
    expect(isSupportedSupabaseVersion('4.0.0')).toBe(false)
  })

  it('ferma ciò che non è una versione, invece di lasciarlo passare', () => {
    expect(isSupportedSupabaseVersion('')).toBe(false)
    expect(isSupportedSupabaseVersion('command not found')).toBe(false)
    expect(isSupportedSupabaseVersion('3')).toBe(false)
  })
})

describe('db-prepush.sh', () => {
  // Letto come testo: il comando ferma lo stack di sviluppo, e qui si
  // controllano solo le regole che, violate, toccano dati veri.
  const script = readFileSync(join(__dirname, '..', 'scripts', 'prepush', 'db-prepush.sh'), 'utf8')
  const commands = script.split('\n').filter((line) => !line.trimStart().startsWith('#'))

  it('non usa mai --no-backup, che cancella i volumi del progetto', () => {
    expect(commands.filter((line) => line.includes('--no-backup'))).toEqual([])
  })

  // Fino alla v2 il default era la produzione; dalla v3 è il locale. Il flag
  // esplicito serve in tutti e due i casi: il comando parla con l'uno o con
  // l'altro a seconda della modalità, mai per default.
  it('ogni chiamata a db o test db dice su quale database, perché il default dipende dalla versione della CLI', () => {
    const calls = commands.filter((line) => /supabase (db|test db) /.test(line) && !/^\s*echo /.test(line))
    expect(calls.length).toBeGreaterThanOrEqual(5)
    const implicit = calls.filter((line) => !/--local|--linked|"\$SOURCE_FLAG"|"\$@"/.test(line))
    expect(implicit).toEqual([])
  })

  // Il 29 set 2026 due pre-push della #184 nello stesso giorno: il secondo ha
  // sovrascritto il backup del primo, e la fotografia di prima della prima
  // migrazione è andata persa.
  it('il nome dei backup di produzione porta anche l\'ora, così due corse nello stesso giorno non si sovrascrivono', () => {
    const naming = commands.filter((line) => line.includes('BACKUP="$ROOT/backup_pre'))
    expect(naming).toHaveLength(1)
    expect(naming[0]).toMatch(/date \+%Y%m%d-%H%M%S/)
  })

  // #258: copiato dopo `[db]`, un project_id in supabase/config.toml diventava
  // db.project_id, e la CLI 3.0.0 lo ignora senza avvisare.
  it('la configurazione dell’ombra passa dal filtro sul project_id, mai dalla copia del file vero', () => {
    expect(commands.filter((line) => /cat .*supabase\/config\.toml/.test(line))).toEqual([])
    expect(commands.filter((line) => line.includes('commands.ts shadow-config'))).toHaveLength(1)
  })

  it('il nome dello stack di sviluppo segue la regola della CLI, non il solo nome della cartella', () => {
    const devProject = commands.filter((line) => /^DEV_PROJECT=/.test(line))
    expect(devProject).toHaveLength(1)
    expect(devProject[0]).toContain('commands.ts project-id')
  })

  // SUPABASE_PROJECT_ID vince sul file: nella v3 rinomina i container, nella v2
  // sceglie anche il progetto ospitato. Lo script non la usa e non la accetta.
  // Dalla v3 una db query su un progetto ospitato chiede conferma, e con
  // l'uscita JSON non può chiederla. --read-only la salta; --yes e
  // SUPABASE_YES approverebbero anche una scrittura (ADR 0033 della CLI).
  it('ogni db query è di sola lettura, e niente approva una scrittura', () => {
    const queries = commands.filter((line) => line.includes('supabase db query'))
    expect(queries.length).toBeGreaterThanOrEqual(1)
    expect(queries.filter((line) => !line.includes('--read-only'))).toEqual([])
    expect(commands.filter((line) => /--yes\b|SUPABASE_YES/.test(line))).toEqual([])
  })

  it('controlla la versione della CLI prima della prima lettura', () => {
    const check = commands.findIndex((line) => line.includes('commands.ts supabase-version'))
    const firstQuery = commands.findIndex((line) => /^query /.test(line))
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(firstQuery)
  })

  it('non imposta SUPABASE_PROJECT_ID, e si ferma se arriva dall’ambiente o da un .env', () => {
    expect(commands.filter((line) => /SUPABASE_PROJECT_ID=/.test(line) && !/grep/.test(line))).toEqual([])
    const guards = commands.filter((line) => line.includes('SUPABASE_PROJECT_ID'))
    expect(guards.some((line) => line.includes('${SUPABASE_PROJECT_ID:-}'))).toBe(true)
    expect(guards.some((line) => /grep .*\.env\*/.test(line))).toBe(true)
  })
})
