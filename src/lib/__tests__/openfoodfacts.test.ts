/**
 * #146 — la scansione propone la categoria giusta per tutte le voci della mappatura.
 *
 * La mappatura confrontava `name_it` con nomi italiani scritti a mano, e quattro
 * non esistevano nel database («Carni», «Verdure», «Cereali e derivati»,
 * «Dolci»): per carne, verdura, pane e pasta e snack la categoria restava vuota.
 * Ora si aggancia a `categories.name`, l'identificativo stabile del bundle
 * (`entro-family/core/categories.md`), che non cambia se cambia il nome a schermo.
 */
import { describe, expect, it } from 'vitest'
import { mapProductToFormData } from '@/lib/openfoodfacts'

// Le categorie come le consegna il database: `name` stabile, `name_it` a schermo.
const categories = [
  { id: 'c-dairy', name: 'dairy', name_it: 'Latticini' },
  { id: 'c-meat', name: 'meat', name_it: 'Carne' },
  { id: 'c-fish', name: 'fish', name_it: 'Pesce' },
  { id: 'c-fruits', name: 'fruits', name_it: 'Frutta' },
  { id: 'c-vegetables', name: 'vegetables', name_it: 'Verdura' },
  { id: 'c-bakery', name: 'bakery', name_it: 'Pane e Pasta' },
  { id: 'c-beverages', name: 'beverages', name_it: 'Bevande' },
  { id: 'c-frozen', name: 'frozen', name_it: 'Surgelati' },
  { id: 'c-condiments', name: 'condiments', name_it: 'Condimenti' },
  { id: 'c-snacks', name: 'snacks', name_it: 'Snack' },
  { id: 'c-other', name: 'other', name_it: 'Altro' },
]

const product = (tag: string) => ({ code: '0', product_name: 'Prodotto', categories_tags: [`en:${tag}`] })

describe('mapProductToFormData — la categoria', () => {
  it.each([
    ['dairies', 'c-dairy'],
    ['meats', 'c-meat'],
    ['fish', 'c-fish'],
    ['fruits', 'c-fruits'],
    ['vegetables', 'c-vegetables'],
    ['breads', 'c-bakery'],
    ['beverages', 'c-beverages'],
    ['sweets', 'c-snacks'],
    ['condiments', 'c-condiments'],
    ['frozen', 'c-frozen'],
  ])('un prodotto «%s» diventa la categoria %s', (tag, expectedId) => {
    expect(mapProductToFormData(product(tag), categories).category_id).toBe(expectedId)
  })

  it('un prodotto senza tag riconosciuti diventa «Altro»', () => {
    expect(mapProductToFormData(product('unknown-thing'), categories).category_id).toBe('c-other')
  })

  it('aggancia per identificativo: una categoria rinominata a schermo resta agganciata', () => {
    const renamed = categories.map((c) => (c.name === 'meat' ? { ...c, name_it: 'Carni e salumi' } : c))

    expect(mapProductToFormData(product('meats'), renamed).category_id).toBe('c-meat')
  })
})

describe('mapProductToFormData — la posizione', () => {
  it('non propone una posizione: la decide la categoria, come quando la si sceglie a mano', () => {
    expect(mapProductToFormData(product('beverages'), categories)).not.toHaveProperty('storage_location')
  })
})
