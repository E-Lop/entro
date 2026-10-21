/**
 * Lo script del seme valida le righe prima di toccare l'utente canonico (#234).
 *
 * Il seme arriva dal bundle, anche da una cartella indicata con
 * `ENTRO_FAMILY_DIR`, quindi può essere un lavoro a metà. Uno stato che la
 * data non produce verrebbe scritto lo stesso, perché lo script non lo usa; e
 * un'unità sbagliata la ferma il `CHECK` solo dopo che gli alimenti di prima
 * sono stati tolti. Trovato dalla revisione di CodeRabbit sulla PR #245.
 *
 * Gli helper sono finti: qui si prova che con un seme sbagliato non parte
 * nessuna scrittura. Il seme è scritto qui, non letto dal bundle, perché
 * `npm test` deve passare in un clone nuovo.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tables: string[] = []
const helpers = vi.hoisted(() => ({
  createE2EUser: vi.fn(),
  createListForUser: vi.fn(),
  findUserByEmail: vi.fn(),
  listE2EFoodImages: vi.fn(),
  removeE2EFoodImages: vi.fn(),
  signInAsUser: vi.fn(),
}))

vi.mock('./e2e/helpers/supabase.ts', () => ({
  ...helpers,
  E2E_PASSWORD: 'non-usata',
  adminClient: {
    from: (table: string) => {
      tables.push(table)
      return {
        select: async () => ({ data: [{ id: 1, name: 'dairy' }], error: null }),
      }
    },
  },
}))

const VALID_ROW = {
  category: 'dairy',
  name: 'Latte intero',
  storage: 'fridge',
  quantity: 2,
  unit: 'l',
  days: 0,
  expiryStatus: 'expires_today',
}

let bundle: string

beforeEach(() => {
  bundle = mkdtempSync(join(tmpdir(), 'seed-'))
  mkdirSync(join(bundle, 'conventions'))
  vi.stubEnv('ENTRO_FAMILY_DIR', bundle)
})

afterEach(() => {
  rmSync(bundle, { recursive: true, force: true })
  vi.unstubAllEnvs()
  tables.length = 0
  Object.values(helpers).forEach((fn) => fn.mockClear())
})

function writeSeed(rows: object[]): void {
  writeFileSync(join(bundle, 'conventions', 'test-data-seed.json'), JSON.stringify(rows))
}

describe('lo script del seme, con un seme sbagliato', () => {
  it.each([
    ['uno stato che la data non produce', { ...VALID_ROW, days: 30 }, 'stato dichiarato in «Latte intero»: expires_today, la data produce fresh'],
    ["un'unità che il database rifiuterebbe", { ...VALID_ROW, unit: 'barattoli' }, 'unità sconosciuta in «Latte intero»: barattoli'],
    ['una categoria che il database non ha', { ...VALID_ROW, category: 'spezie' }, 'categoria sconosciuta in «Latte intero»: spezie'],
  ])('si ferma su %s, prima di ogni scrittura', async (_, row, problem) => {
    writeSeed([row])
    const { seed } = await import('../scripts/test-data/seed.ts')

    await expect(seed(true)).rejects.toThrow(problem)

    // Letta solo la tabella delle categorie, nessun utente cercato o toccato.
    expect(tables).toEqual(['categories'])
    for (const fn of Object.values(helpers)) expect(fn).not.toHaveBeenCalled()
  })
})
