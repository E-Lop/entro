/**
 * L'ordine delle categorie, e perché la colonna su cui si ordina è quella che
 * si legge.
 *
 * `getCategories` ordinava per `name`, che è il nome **inglese**, mentre a
 * schermo compare `name_it`: l'elenco arrivava alfabetico in una lingua e
 * veniva mostrato in un'altra, quindi sembrava casuale. Scoperto sul nativo
 * (E-Lop/entro-mobile#47), ma `getCategories` è lo stesso codice sui due
 * client: il difetto era qui identico, e la correzione va fatta nella stessa
 * passata o i due client divergono — è la premessa che ha prodotto la
 * convenzione `expiry-status-ssot`.
 *
 * ## Perché tre prove e non una
 *
 * La prima guarda la query — l'unica cosa che questo lato del confine può
 * decidere. L'ordinamento vero lo fa Postgres, e un test unitario non può
 * vederlo: può solo provare che gli chiediamo la colonna giusta.
 *
 * La seconda guarda il **motivo**, sul vocabolario vero letto dalle
 * migrazioni. Senza, la prima sarebbe una stringa confrontata con se stessa.
 *
 * La terza tiene ferma la precondizione che rende la correzione una riga sola:
 * `name_it` è dichiarata `text not null` senza `COLLATE`, quindi eredita la
 * collazione di database, e sugli undici nomi del seed — ASCII, iniziale
 * maiuscola uniforme, nessun accento — `C`, `en_US.UTF-8` e `it-IT-x-icu`
 * danno lo stesso ordine. Il giorno in cui non varrà più, la correzione non
 * sarà più nel client: la sintassi `order` di PostgREST porta colonna,
 * direzione e posizione dei null, e non sa esprimere un `COLLATE`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFrom, mockBuilder } = vi.hoisted(() => {
  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn(),
  }
  return { mockFrom: vi.fn(() => mockBuilder), mockBuilder }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))
vi.mock('@/lib/safeLog', () => ({ logError: vi.fn(), logWarn: vi.fn() }))
vi.mock('@/lib/storage', () => ({ deleteFoodImage: vi.fn() }))
vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: vi.fn(() => false),
  deletePendingImage: vi.fn(),
}))

import { getCategories } from '@/lib/foods'

const CARTELLA_MIGRAZIONI = resolve(__dirname, '..', '..', '..', 'supabase', 'migrations')

/** Le coppie `(name, name_it)` del seed delle categorie. */
function categorieDelSeed(): { name: string; name_it: string }[] {
  if (!existsSync(CARTELLA_MIGRAZIONI)) {
    throw new Error(`Migrazioni non trovate in ${CARTELLA_MIGRAZIONI}`)
  }

  const blocchi = readdirSync(CARTELLA_MIGRAZIONI)
    .filter((nome) => nome.endsWith('.sql'))
    .map((nome) => readFileSync(join(CARTELLA_MIGRAZIONI, nome), 'utf8'))
    .flatMap((sql) => {
      const inizio = sql.indexOf('insert into public.categories (')
      if (inizio === -1) return []
      return [sql.slice(inizio, sql.indexOf('on conflict', inizio))]
    })

  expect(blocchi).toHaveLength(1)

  // `('bakery', 'Pane e Pasta', 'wheat', …)` → le prime due stringhe di ogni riga.
  return [...blocchi[0].matchAll(/\(\s*'([^']+)',\s*'([^']+)'/g)].map((riga) => ({
    name: riga[1],
    name_it: riga[2],
  }))
}

const perNome = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

beforeEach(() => {
  vi.clearAllMocks()
  mockBuilder.select.mockReturnThis()
  mockBuilder.order.mockResolvedValue({ data: [], error: null })
})

describe('getCategories — si ordina per la colonna che si legge', () => {
  it("chiede a Postgres l'ordinamento su `name_it`, non sul nome inglese", async () => {
    await getCategories()

    expect(mockFrom).toHaveBeenCalledWith('categories')
    expect(mockBuilder.order).toHaveBeenCalledTimes(1)
    expect(mockBuilder.order).toHaveBeenCalledWith('name_it', { ascending: true })
  })

  it("propaga le righe nell'ordine in cui il database le restituisce", async () => {
    const righe = [
      { id: '1', name_it: 'Altro' },
      { id: '2', name_it: 'Bevande' },
    ]
    mockBuilder.order.mockResolvedValue({ data: righe, error: null })

    const { categories, error } = await getCategories()

    expect(error).toBeNull()
    expect(categories).toEqual(righe)
  })
})

describe('il motivo: i due nomi non ordinano allo stesso modo', () => {
  it("l'ordine inglese non è l'ordine italiano, sul vocabolario vero", () => {
    const categorie = categorieDelSeed()

    // Senza questa riga il test passerebbe anche a seed vuoto o non agganciato
    // dalla regex, che è la forma peggiore di verde.
    expect(categorie.length).toBeGreaterThan(5)

    const secondoInglese = [...categorie]
      .sort((a, b) => perNome(a.name, b.name))
      .map((c) => c.name_it)
    const secondoItaliano = [...categorie]
      .sort((a, b) => perNome(a.name_it, b.name_it))
      .map((c) => c.name_it)

    expect(secondoInglese).not.toEqual(secondoItaliano)
  })

  it('`bakery` precede `beverages` in inglese, ma «Bevande» precede «Pane e Pasta» in italiano', () => {
    const categorie = categorieDelSeed()
    const pane = categorie.find((c) => c.name === 'bakery')
    const bevande = categorie.find((c) => c.name === 'beverages')

    expect(pane?.name_it).toBe('Pane e Pasta')
    expect(bevande?.name_it).toBe('Bevande')
    // È la coppia che si inverte: se l'ordinamento tornasse su `name`, questa
    // sarebbe la prima riga sbagliata che l'utente vede in cima all'elenco.
    expect(perNome(pane!.name, bevande!.name)).toBeLessThan(0)
    expect(perNome(pane!.name_it, bevande!.name_it)).toBeGreaterThan(0)
  })
})

describe('la precondizione che tiene la correzione a una riga', () => {
  it('nessun nome italiano richiede una collazione linguistica', () => {
    const categorie = categorieDelSeed()

    // ASCII, iniziale maiuscola, nessun accento: su questo insieme `C`,
    // `en_US.UTF-8` e `it-IT-x-icu` producono lo stesso ordine. Se questa
    // prova fallisce, la collazione ha smesso di essere irrilevante e va
    // decisa lato database — vedi il commento in testa a questo file.
    const problematici = categorie
      .map((c) => c.name_it)
      .filter((nome) => !/^[A-Z][A-Za-z ]*$/.test(nome))

    expect(problematici).toEqual([])
  })
})
