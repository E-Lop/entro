/**
 * Mappatura fra i parametri d'URL della dashboard e FilterParams.
 *
 * Esiste come modulo a sé perché la retrocompatibilità del vecchio parametro
 * `?status=` è una promessa verso link già salvati e condivisi: va provata,
 * e provarla dentro un `useMemo` della pagina vorrebbe dire montare tutta la
 * dashboard per verificare una traduzione di stringhe.
 */
import { describe, it, expect } from 'vitest'
import { parseFilterParams, buildSearchParams } from '@/lib/foodFilterParams'

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe('parseFilterParams', () => {
  it('legge il parametro nuovo', () => {
    expect(parseFilterParams(params('expiry=expired')).expiry).toBe('expired')
  })

  it('vale "all" quando il parametro manca', () => {
    expect(parseFilterParams(params('')).expiry).toBe('all')
  })

  it('accetta ancora il vecchio ?status=, che sta nei link salvati', () => {
    expect(parseFilterParams(params('status=expired')).expiry).toBe('expired')
  })

  it('traduce il vecchio valore "active" nel nuovo "not_expired"', () => {
    // Il vecchio `active` non voleva dire "non concluso" come nel ciclo di
    // vita, ma "non scaduto": la traduzione conserva il significato, non la
    // parola.
    expect(parseFilterParams(params('status=active')).expiry).toBe('not_expired')
  })

  it('preferisce il parametro nuovo quando ci sono entrambi', () => {
    expect(parseFilterParams(params('status=active&expiry=expired')).expiry).toBe('expired')
  })

  it('ignora un valore che non appartiene al vocabolario', () => {
    expect(parseFilterParams(params('expiry=banana')).expiry).toBe('all')
  })

  it('scarta un valore fuori vocabolario anche sugli altri filtri', () => {
    // Prima la pagina si fidava dell'URL e passava il valore così com'era:
    // `?storage=banana` finiva nel confronto e svuotava la lista. Ora un
    // parametro che non appartiene al vocabolario torna al suo default.
    const filters = parseFilterParams(params('storage=banana&sortBy=banana&sortOrder=banana'))

    expect(filters.storage_location).toBeUndefined()
    expect(filters.sortBy).toBe('expiry_date')
    expect(filters.sortOrder).toBe('asc')
  })

  it('legge anche gli altri filtri', () => {
    const filters = parseFilterParams(
      params('category=c1&storage=fridge&search=latte&sortBy=name&sortOrder=desc')
    )

    expect(filters).toMatchObject({
      category_id: 'c1',
      storage_location: 'fridge',
      search: 'latte',
      sortBy: 'name',
      sortOrder: 'desc',
    })
  })
})

describe('buildSearchParams', () => {
  it('scrive il parametro nuovo', () => {
    expect(buildSearchParams({ expiry: 'expired' }).get('expiry')).toBe('expired')
  })

  it('non scrive più il vecchio nome, nemmeno insieme al nuovo', () => {
    expect(buildSearchParams({ expiry: 'expired' }).get('status')).toBeNull()
  })

  it('omette il filtro quando vale "all", per non sporcare l\'URL', () => {
    expect(buildSearchParams({ expiry: 'all' }).get('expiry')).toBeNull()
  })

  it('scrive solo i filtri che riceve', () => {
    // È la proprietà su cui si appoggiano le card delle statistiche: passano
    // il solo `expiry` proprio per azzerare gli altri filtri.
    expect([...buildSearchParams({ expiry: 'expired' }).keys()]).toEqual(['expiry'])
    expect([...buildSearchParams({ expiry: 'all' }).keys()]).toEqual([])
  })

  it('fa il giro completo: quello che scrive, sa rileggerlo', () => {
    const originali = {
      category_id: 'c1',
      storage_location: 'freezer' as const,
      expiry: 'expiring_soon' as const,
      search: 'pane',
      sortBy: 'name' as const,
      sortOrder: 'desc' as const,
    }

    expect(parseFilterParams(buildSearchParams(originali))).toMatchObject(originali)
  })
})
