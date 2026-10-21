/**
 * Il guardiano del seme dei dati di prova (#234).
 *
 * Il seme è un dato del bundle, `conventions/test-data-seed.json`, ed entro lo
 * esegue con `npm run seed:local`. Qui si rilegge e si controllano due cose:
 * ogni riga dichiara lo stato che il suo scarto in giorni produce davvero con
 * `getExpiryStatus`, e fra tutte le righe ci sono ogni categoria, ogni
 * conservazione, ogni unità e ogni stato che `core/` dichiara.
 *
 * Il guardiano stava in entro-mobile (`seedTestFoods.test.ts`), accanto allo
 * script che eseguiva il seme. Ora lo esegue entro, che possiede il database,
 * e il guardiano sta qui e solo qui.
 *
 * Gli ultimi casi alterano una copia del seme e la vogliono rossa: un
 * guardiano che nessuno ha mai visto fallire non prova niente.
 */
import { describe, expect, it } from 'vitest'
import { bundleConvention, categoryNames, pageLabels, unitForms } from './familyBundle'
import { parseSeed, seedProblems, type SeedFood, type SeedVocabulary } from '../../../scripts/test-data/seedRows'
import { romeDay } from '../../../tests/smoke/calendarDay'
import { statusOn } from '../../../tests/smoke/knownFoods'

const seed = parseSeed(bundleConvention('test-data-seed.json'))

const vocabulary: SeedVocabulary = {
  categories: categoryNames(),
  storages: [...pageLabels('storage-and-units').keys()],
  units: [...unitForms('storage-and-units').keys()],
  statuses: [...pageLabels('expiry-status').keys()],
}

const today = romeDay(new Date())

function problems(rows: readonly SeedFood[]): string[] {
  return seedProblems(rows, vocabulary, statusOn, today)
}

describe('il seme dei dati di prova', () => {
  it('legge un vocabolario completo dal bundle', () => {
    // Un vocabolario vuoto renderebbe vuota anche la copertura, cioè verde.
    expect(vocabulary.categories).toHaveLength(11)
    expect(vocabulary.storages).toHaveLength(3)
    expect(vocabulary.units).toHaveLength(6)
    expect(vocabulary.statuses).toHaveLength(5)
  })

  it('ha le undici righe del contratto', () => {
    expect(seed).toHaveLength(11)
  })

  it('non ha problemi', () => {
    expect(problems(seed)).toEqual([])
  })

  it.each(seed.map((food) => [food.name, food] as const))(
    '«%s» dichiara lo stato che il suo scarto produce',
    (_, food) => {
      expect(problems([food]).filter((p) => p.startsWith('stato dichiarato'))).toEqual([])
    }
  )
})

describe('il guardiano diventa rosso', () => {
  it('se una riga dichiara uno stato che la data non produce', () => {
    const altered = seed.map((food, i) => (i === 0 ? { ...food, days: food.days + 30 } : food))
    expect(problems(altered)).toContainEqual(
      'stato dichiarato in «Latte intero»: expires_today, la data produce fresh'
    )
  })

  it.each([
    ['categoria', 'category'],
    ['conservazione', 'storage'],
    ['unità', 'unit'],
    ['stato', 'expiryStatus'],
  ] as const)('se manca una %s del bundle', (word, field) => {
    const missing = seed[0][field]
    const altered = seed.filter((food) => food[field] !== missing)
    expect(problems(altered)).toContainEqual(`${word} senza righe: ${missing}`)
  })

  it('se una riga usa un valore che il bundle non conosce', () => {
    const altered = [...seed, { ...seed[0], unit: 'barattoli' }]
    expect(problems(altered)).toContainEqual('unità sconosciuta in «Latte intero»: barattoli')
  })
})
