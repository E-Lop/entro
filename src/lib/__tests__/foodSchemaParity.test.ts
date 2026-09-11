/**
 * I due client devono concordare su cosa sia un alimento valido.
 *
 * `foodVocabulary.test.ts` lega i tre enum al `CHECK` del database, e lì si
 * ferma. Fuori dal suo confronto resta tutto il resto dello schema: il formato
 * della data, il `min(0.01)` della quantità, le lunghezze massime di `name` e
 * `notes`, la nullabilità dei campi opzionali. I due `food.schemas.ts` sono
 * **due copie in due repo**, e questo è il difetto che la [#120] descrive.
 *
 * Il gemello di questo file vive su entro-mobile da settembre e guarda nella
 * direzione opposta. Averlo da un lato solo lasciava un buco asimmetrico: una
 * modifica fatta **qui** non diventava rossa qui, ma sulla CI dell'altro repo, e
 * solo al suo prossimo push. Chi aveva fatto la modifica non lo vedeva, e chi lo
 * vedeva non aveva il contesto per capirlo.
 *
 * Si confrontano i **comportamenti**, non il testo dei due file: i commenti
 * divergono legittimamente e un diff testuale fallirebbe su quelli invece che
 * sulle regole. La batteria qui sotto copre ogni vincolo dichiarato, compresi i
 * valori al limite, che sono il posto dove `min`/`max` si sbagliano davvero.
 *
 * Non si confrontano i **messaggi** d'errore: sono testo che l'utente legge, e
 * la piattaforma può volerli diversi. Si confronta invece l'insieme dei campi
 * che hanno fallito, così un rifiuto per il motivo sbagliato non passa per
 * accordo.
 */
import { describe, it, expect } from 'vitest'
import { foodFormSchema } from '../validations/food.schemas'
import { twinFormSchema } from './twinSchema'

const twin = await twinFormSchema()

/**
 * `YYYY-MM-DD` a `days` giorni di distanza da oggi, nel fuso **locale**.
 *
 * Composta a mano dai componenti e non con `toISOString()`, che formatta in
 * UTC: a est di Greenwich la mezzanotte locale cade il giorno prima in UTC, e
 * `day(0)` avrebbe prodotto *ieri* sulla macchina di chi sviluppa e *oggi* sul
 * runner della CI. I casi si sarebbero chiamati allo stesso modo nei due posti
 * coprendo confini diversi, che è il difetto peggiore in un file che serve a
 * sorvegliare i confini.
 */
function day(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

/** Un alimento valido e minimo: solo i quattro campi obbligatori. */
function base(): Record<string, unknown> {
  return {
    name: 'Latte intero',
    category_id: 'c1',
    expiry_date: day(1),
    storage_location: 'fridge',
  }
}

function having(fields: Record<string, unknown>): Record<string, unknown> {
  return { ...base(), ...fields }
}

/**
 * L'esito confrontabile: se ha passato, e quali campi hanno fallito.
 *
 * I campi si ordinano perché l'ordine degli `issues` è un dettaglio di zod, non
 * una regola di dominio.
 */
function outcome(schema: { safeParse: (v: unknown) => unknown }, payload: unknown) {
  const r = schema.safeParse(payload) as {
    success: boolean
    error?: { issues: readonly { path: readonly PropertyKey[] }[] }
  }
  return {
    accepted: r.success,
    fieldsInError: (r.error?.issues ?? []).map((i) => i.path.join('.')).sort(),
  }
}

/**
 * `[nome del caso, payload]`.
 *
 * Ogni riga è un vincolo dichiarato in uno dei due file. I limiti si provano a
 * cavallo — 100 e 101, 500 e 501, 0.01 e 0.004 — perché un `max` sbagliato di
 * uno passa qualunque prova fatta lontano dal bordo.
 *
 * La lista è **la stessa** del gemello su entro-mobile, e deve restarlo: se una
 * riga vale la pena qui, vale la pena là. Divergendo, i due guardiani
 * coprirebbero insiemi diversi e nessuno dei due direbbe quale.
 */
const CASES: [string, Record<string, unknown>][] = [
  ['il minimo valido', base()],

  ['name vuoto', having({ name: '' })],
  ['name di 100 caratteri', having({ name: 'a'.repeat(100) })],
  ['name di 101 caratteri', having({ name: 'a'.repeat(101) })],
  ['name assente', { ...base(), name: undefined }],

  ['category_id vuoto', having({ category_id: '' })],
  ['category_id assente', { ...base(), category_id: undefined }],

  ['expiry_date vuota', having({ expiry_date: '' })],
  ['expiry_date non interpretabile', having({ expiry_date: 'trentadue marzo' })],
  ['expiry_date di ieri', having({ expiry_date: day(-1) })],
  ['expiry_date di oggi', having({ expiry_date: day(0) })],
  ['expiry_date di un anno fa', having({ expiry_date: day(-365) })],

  ['storage_location fuori vocabolario', having({ storage_location: 'garage' })],
  ['storage_location assente', { ...base(), storage_location: undefined }],
  ['storage_location = freezer', having({ storage_location: 'freezer' })],
  ['storage_location = pantry', having({ storage_location: 'pantry' })],

  ['quantity assente', base()],
  ['quantity null', having({ quantity: null })],
  ['quantity 0', having({ quantity: 0 })],
  ['quantity 0.004, che la colonna arrotonderebbe a 0.00', having({ quantity: 0.004 })],
  ['quantity 0.01, il minimo che numeric(10,2) sa tenere', having({ quantity: 0.01 })],
  ['quantity negativa', having({ quantity: -1 })],
  ['quantity come stringa', having({ quantity: '2' })],

  ['quantity_unit fuori vocabolario', having({ quantity_unit: 'litri' })],
  ['quantity_unit null', having({ quantity_unit: null })],
  ['quantity_unit = confezioni', having({ quantity_unit: 'confezioni' })],

  ['notes di 500 caratteri', having({ notes: 'n'.repeat(500) })],
  ['notes di 501 caratteri', having({ notes: 'n'.repeat(501) })],
  ['notes null', having({ notes: null })],

  ['image_url vuota', having({ image_url: '' })],
  ['image_url null', having({ image_url: null })],
  ['image_url come path', having({ image_url: 'utente/alimento.jpg' })],
]

describe('lo schema del form è lo stesso sui due client', () => {
  it.each(CASES)('%s', (_name, payload) => {
    expect(outcome(foodFormSchema, payload)).toEqual(outcome(twin, payload))
  })
})

/**
 * Le divergenze **dichiarate**.
 *
 * Una sola, e ha una ragione di piattaforma: qui il form può portare il file
 * scelto dall'utente prima di caricarlo, quindi `image_url` è `string | File`;
 * su entro-mobile la scelta passa dal picker nativo e arriva sempre come path,
 * quindi è `string`. È la stessa distinzione dominio/piattaforma di
 * `conventions/shared-domain-native-platform.md`.
 *
 * L'asserzione è **simmetrica**, e non per pignoleria: se qualcuno allineasse i
 * due lati questo test diventerebbe rosso e costringerebbe a cancellare la
 * dichiarazione. Una divergenza che sparisce senza che nessuno se ne accorga è
 * lo stesso difetto della #120, girato al contrario.
 */
describe('le divergenze dichiarate', () => {
  it('image_url: qui passa anche un File, su entro-mobile solo un path', () => {
    const payload = having({ image_url: new File([], 'alimento.jpg') })

    expect(outcome(foodFormSchema, payload).accepted).toBe(true)
    expect(outcome(twin, payload).accepted).toBe(false)
  })
})
