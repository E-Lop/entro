import { describe, it, expect } from 'vitest'
import type { Food, FilterParams } from '@/lib/foods'
import { filterFoods, sortFoods, deriveDashboardData } from '@/lib/foodFilters'

const NOW = new Date('2026-06-16T12:00:00')

function makeFood(over: Partial<Food> & { name: string; expiry_date: string }): Food {
  return {
    id: over.name,
    name: over.name,
    expiry_date: over.expiry_date,
    category_id: over.category_id ?? null,
    storage_location: over.storage_location ?? 'fridge',
    quantity: null, quantity_unit: null, notes: null, image_url: null,
    barcode: null, status: 'active', consumed_at: null, deleted_at: null,
    user_id: 'u', list_id: null,
    created_at: over.created_at ?? '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  } as Food
}

const dExpired = '2026-06-15'
const dToday = '2026-06-16'
const dSoon = '2026-06-18'
const dWeek = '2026-06-23'
const dFresh = '2026-06-24'

const foods: Food[] = [
  makeFood({ name: 'Latte', expiry_date: dToday, category_id: 'c1', storage_location: 'fridge' }),
  makeFood({ name: 'Yogurt', expiry_date: dSoon, category_id: 'c1', storage_location: 'fridge' }),
  makeFood({ name: 'Pane', expiry_date: dWeek, category_id: 'c2', storage_location: 'pantry' }),
  makeFood({ name: 'Tonno', expiry_date: dFresh, category_id: 'c2', storage_location: 'pantry' }),
  makeFood({ name: 'Ricotta', expiry_date: dExpired, category_id: 'c1', storage_location: 'fridge' }),
]

describe('filterFoods - stato (business rule + confini)', () => {
  it('all → tutti', () => {
    expect(filterFoods(foods, { status: 'all' }, NOW)).toHaveLength(5)
  })
  it('expiring_soon → oggi/soon/this_week (0..7 giorni)', () => {
    const names = filterFoods(foods, { status: 'expiring_soon' }, NOW).map(f => f.name).sort()
    expect(names).toEqual(['Latte', 'Pane', 'Yogurt'])
  })
  it('expired → solo passato', () => {
    expect(filterFoods(foods, { status: 'expired' }, NOW).map(f => f.name)).toEqual(['Ricotta'])
  })
  it('active → tutto tranne lo scaduto', () => {
    const names = filterFoods(foods, { status: 'active' }, NOW).map(f => f.name).sort()
    expect(names).toEqual(['Latte', 'Pane', 'Tonno', 'Yogurt'])
  })
  it('confine: +8 giorni è fresh, non expiring_soon', () => {
    expect(filterFoods([makeFood({ name: 'X', expiry_date: dFresh })], { status: 'expiring_soon' }, NOW)).toHaveLength(0)
  })
})

describe('filterFoods - categoria / posizione / ricerca', () => {
  it('category_id match esatto', () => {
    expect(filterFoods(foods, { status: 'all', category_id: 'c2' }, NOW).map(f => f.name).sort()).toEqual(['Pane', 'Tonno'])
  })
  it('storage_location match esatto', () => {
    expect(filterFoods(foods, { status: 'all', storage_location: 'pantry' }, NOW).map(f => f.name).sort()).toEqual(['Pane', 'Tonno'])
  })
  it('search substring case-insensitive con trim', () => {
    expect(filterFoods(foods, { status: 'all', search: '  YOG ' }, NOW).map(f => f.name)).toEqual(['Yogurt'])
  })
  it('search vuota = nessun filtro', () => {
    expect(filterFoods(foods, { status: 'all', search: '   ' }, NOW)).toHaveLength(5)
  })
  it('combina filtri: categoria + stato', () => {
    const names = filterFoods(foods, { status: 'expiring_soon', category_id: 'c1' }, NOW).map(f => f.name).sort()
    expect(names).toEqual(['Latte', 'Yogurt'])
  })
})

describe('sortFoods', () => {
  const items: Food[] = [
    makeFood({ name: 'Banana', expiry_date: '2026-06-20', category_id: 'b', created_at: '2026-06-03T00:00:00Z' }),
    makeFood({ name: 'ananas', expiry_date: '2026-06-10', category_id: null, created_at: '2026-06-01T00:00:00Z' }),
    makeFood({ name: 'Cocco', expiry_date: '2026-06-15', category_id: 'a', created_at: '2026-06-02T00:00:00Z' }),
  ]
  it('expiry_date asc (default)', () => {
    expect(sortFoods(items, 'expiry_date', 'asc').map(f => f.expiry_date)).toEqual(['2026-06-10', '2026-06-15', '2026-06-20'])
  })
  it('expiry_date desc', () => {
    expect(sortFoods(items, 'expiry_date', 'desc').map(f => f.expiry_date)).toEqual(['2026-06-20', '2026-06-15', '2026-06-10'])
  })
  it('name asc case-insensitive', () => {
    expect(sortFoods(items, 'name', 'asc').map(f => f.name)).toEqual(['ananas', 'Banana', 'Cocco'])
  })
  it('created_at desc', () => {
    expect(sortFoods(items, 'created_at', 'desc').map(f => f.created_at)).toEqual(['2026-06-03T00:00:00Z', '2026-06-02T00:00:00Z', '2026-06-01T00:00:00Z'])
  })
  it('category_id: i null finiscono in fondo', () => {
    expect(sortFoods(items, 'category_id', 'asc').map(f => f.category_id)).toEqual(['a', 'b', null])
  })
  it('non muta l\'array di input', () => {
    const copy = [...items]
    sortFoods(items, 'name', 'asc')
    expect(items).toEqual(copy)
  })
})

describe('deriveDashboardData', () => {
  it('stats riflettono i filtri non-stato; lista applica anche lo stato', () => {
    const { foods: list, stats } = deriveDashboardData(foods, { status: 'expiring_soon', sortBy: 'expiry_date', sortOrder: 'asc' }, NOW)
    expect(stats.total).toBe(5)
    expect(stats.expiringSoon).toBe(3)
    expect(stats.expired).toBe(1)
    expect(list.map(f => f.name)).toEqual(['Latte', 'Yogurt', 'Pane'])
    expect(list.length).toBe(stats.expiringSoon)
  })
  it('i conteggi rispettano un filtro categoria attivo', () => {
    const { stats } = deriveDashboardData(foods, { status: 'all', category_id: 'c1' }, NOW)
    expect(stats.total).toBe(3)
    expect(stats.expiringSoon).toBe(2)
    expect(stats.expired).toBe(1)
  })
})
