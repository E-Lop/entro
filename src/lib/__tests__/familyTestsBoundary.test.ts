/**
 * Un test che legge i repo affiancati deve chiamarsi `*.family.test.*` (#149).
 *
 * `entro-family` ed `entro-mobile` sono privati: i test che li leggono stanno
 * in `npm run test:family`, e `npm test` deve passare in un clone nuovo. Il
 * confine è il nome del file, non una lista da ricordarsi di aggiornare.
 * Questo test, che gira nella suite normale, lo fa rispettare: se un file che
 * legge i repo affiancati non ha quel nome, `npm test` in un clone nuovo
 * sarebbe rosso, ed è meglio saperlo qui.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** Cosa rivela un test che legge i repo affiancati: gli helper, o le variabili che puntano là. */
const READS_SIBLINGS = /from '\.\/(familyBundle|twinSchema)'|ENTRO_FAMILY_DIR|ENTRO_MOBILE_[A-Z_]+_DIR/

function testFiles(): string[] {
  return execSync("git ls-files 'src/**/*.test.ts' 'src/**/*.test.tsx'", { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.endsWith('familyTestsBoundary.test.ts'))
}

describe('i guardiani di famiglia stanno nella loro suite', () => {
  it('la scansione trova dei file di test', () => {
    expect(testFiles().length).toBeGreaterThan(50)
  })

  it('nessun test che legge i repo affiancati è fuori da *.family.test.*', () => {
    const misplaced = testFiles().filter(
      (f) => !/\.family\.test\.tsx?$/.test(f) && READS_SIBLINGS.test(readFileSync(f, 'utf8'))
    )
    expect(misplaced).toEqual([])
  })

  it('i guardiani di famiglia leggono davvero i repo affiancati', () => {
    const family = testFiles().filter((f) => /\.family\.test\.tsx?$/.test(f))
    expect(family.length).toBeGreaterThanOrEqual(6)
    for (const f of family) expect(READS_SIBLINGS.test(readFileSync(f, 'utf8')), f).toBe(true)
  })
})
