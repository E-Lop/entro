/**
 * Livello (b): scritture reversibili sulla lista di A (#187).
 *
 * Un alimento nuovo percorre il ciclo del client: creato, modificato, con un
 * esito, tolto con `deleted_at`. Dopo ogni passo si rilegge dal database: una
 * risposta senza errori non prova che il valore sia stato scritto. Alla fine
 * si cancella per davvero; se il livello si ferma a metà, lo toglie il
 * prossimo ripristino, che cancella ogni alimento estraneo della lista di A.
 */
import { beforeAll, describe, it } from 'vitest'
import { signIn, type Sentinel } from './env'
import { check, must, mustSucceed } from './failure'
import { KNOWN_CATEGORY_NAME, addDays, romeDay } from './knownFoods'
import { listIdsOf } from './restore'

describe('livello b', () => {
  let a: Sentinel
  let listOfA: string
  const id = crypto.randomUUID()

  async function reread() {
    return must(
      await a.client
        .from('foods')
        .select('name, quantity, status, consumed_at, deleted_at')
        .eq('id', id)
        .maybeSingle(),
      'rilettura dell\'alimento del livello b'
    )
  }

  beforeAll(async () => {
    a = await signIn('A')
    const lists = await listIdsOf(a, 'A')
    check(lists.length === 1, 'A non ha esattamente una lista')
    listOfA = lists[0]
  })

  it('A crea un alimento', async () => {
    const category = must(
      await a.client.from('categories').select('id').eq('name', KNOWN_CATEGORY_NAME).maybeSingle(),
      'lettura della categoria'
    )
    mustSucceed(
      await a.client.from('foods').insert({
        id,
        list_id: listOfA,
        user_id: a.userId,
        name: 'Sentinella livello b',
        category_id: category.id,
        storage_location: 'fridge',
        quantity: 1,
        quantity_unit: 'pz',
        expiry_date: addDays(romeDay(new Date()), 3),
      }),
      'creazione dell\'alimento'
    )
    check((await reread()).name === 'Sentinella livello b', 'alimento creato non trovato')
  })

  it('A lo modifica', async () => {
    mustSucceed(
      await a.client.from('foods').update({ name: 'Sentinella livello b modificata', quantity: 2 }).eq('id', id),
      'modifica dell\'alimento'
    )
    const row = await reread()
    check(row.name === 'Sentinella livello b modificata' && Number(row.quantity) === 2, 'modifica non scritta')
  })

  it('A ne registra l\'esito', async () => {
    mustSucceed(
      await a.client.from('foods').update({ status: 'consumed', consumed_at: new Date().toISOString() }).eq('id', id),
      'esito dell\'alimento'
    )
    const row = await reread()
    check(row.status === 'consumed' && row.consumed_at !== null, 'esito non scritto')
  })

  it('A lo toglie con deleted_at', async () => {
    mustSucceed(
      await a.client.from('foods').update({ deleted_at: new Date().toISOString() }).eq('id', id),
      'rimozione dell\'alimento'
    )
    check((await reread()).deleted_at !== null, 'deleted_at non scritto')
  })

  it('A lo cancella per davvero', async () => {
    mustSucceed(await a.client.from('foods').delete().eq('id', id), 'cancellazione dell\'alimento')
    const rows = must(await a.client.from('foods').select('id').eq('id', id), 'rilettura dopo la cancellazione')
    check(rows.length === 0, 'alimento ancora presente dopo la cancellazione')
  })
})
