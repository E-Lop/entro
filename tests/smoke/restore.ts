/**
 * Il ripristino idempotente dei dati noti (#187): due corse di fila lasciano lo
 * stesso stato, e usa solo le sessioni di A e di B.
 *
 * Prima legge e controlla, poi scrive: se una precondizione non vale si ferma
 * senza aver toccato niente. Non fa mai uscire una sentinella dalla propria
 * lista personale.
 *
 * Gli inviti non si toccano: `authenticated` non può né chiuderli né
 * cancellarli finché non arriva la #194. Quelli creati dal livello (c) restano
 * pending e scadono da soli dopo sette giorni.
 */
import type { Sentinel } from './env'
import { check, fail, must, mustSucceed } from './failure'
import {
  KNOWN_CATEGORY_NAME,
  KNOWN_FOODS,
  KNOWN_PHOTO_BYTES,
  KNOWN_PHOTO_NAME,
  addDays,
  checkKnownFoods,
  knownPhotoPath,
  romeDay,
  type KnownFoodRow,
} from './knownFoods'

export const BUCKET = 'food-images'

/** Le liste di una sentinella, lette con la sua sessione. */
export async function listIdsOf(sentinel: Sentinel, who: 'A' | 'B'): Promise<string[]> {
  const rows = must(
    await sentinel.client.from('list_members').select('list_id').eq('user_id', sentinel.userId),
    `lettura delle liste di ${who}`
  )
  return rows.map((row) => row.list_id)
}

/** Le righe della lista di A che il controllo dei dati noti legge. */
export async function knownFoodRows(a: Sentinel, listId: string): Promise<KnownFoodRow[]> {
  return must(
    await a.client
      .from('foods')
      .select('id, name, expiry_date, updated_at, deleted_at, image_url')
      .eq('list_id', listId),
    'lettura degli alimenti di A'
  ) as KnownFoodRow[]
}

async function createPersonalList(sentinel: Sentinel, who: 'A' | 'B'): Promise<void> {
  const rows = must(await sentinel.client.rpc('create_personal_list'), `lista personale di ${who}`)
  const row = Array.isArray(rows) ? rows[0] : rows
  check(row?.success === true, `lista personale di ${who}`)
}

/** Tutti gli oggetti nella cartella di una sentinella, tranne `keep`. */
async function emptyFolder(sentinel: Sentinel, who: 'A' | 'B', keep?: string): Promise<string[]> {
  const objects = must(
    await sentinel.client.storage.from(BUCKET).list(sentinel.userId, { limit: 1000 }),
    `lettura della cartella di ${who}`
  )
  const names = objects.map((object) => object.name)
  const extra = names.filter((name) => name !== keep).map((name) => `${sentinel.userId}/${name}`)
  if (extra.length > 0) {
    must(await sentinel.client.storage.from(BUCKET).remove(extra), `pulizia della cartella di ${who}`)
  }
  return names
}

/** Riscrive i cinque alimenti noti con le date di `today`, e rimette la foto se manca. */
async function writeKnownFoods(a: Sentinel, listId: string, categoryId: string, today: string): Promise<void> {
  const rows = KNOWN_FOODS.map((food) => ({
    id: food.id,
    list_id: listId,
    user_id: a.userId,
    name: food.name,
    category_id: categoryId,
    storage_location: 'fridge',
    quantity: 1,
    quantity_unit: 'pz',
    expiry_date: addDays(today, food.offsetDays),
    image_url: food.hasPhoto ? knownPhotoPath(a.userId) : null,
    notes: null,
    barcode: null,
    status: 'active',
    consumed_at: null,
    deleted_at: null,
  }))
  mustSucceed(await a.client.from('foods').upsert(rows, { onConflict: 'id' }), 'scrittura degli alimenti noti')
}

export interface RestoreOutcome {
  /** B stava nella lista di A, ed è uscito. */
  bLeftListOfA: boolean
}

export async function restore(a: Sentinel, b: Sentinel): Promise<RestoreOutcome> {
  // --- Letture e precondizioni: da qui a «scritture» non si scrive niente.
  const listsOfA = await listIdsOf(a, 'A')
  const listsOfB = await listIdsOf(b, 'B')
  check(listsOfA.length <= 1, 'A ha più di una lista: il ripristino non scrive')
  check(listsOfB.length <= 1, 'B ha più di una lista: il ripristino non scrive')

  const shared = listsOfA.length === 1 && listsOfA[0] === listsOfB[0]
  if (shared) {
    const list = must(
      await a.client.from('lists').select('created_by').eq('id', listsOfA[0]).maybeSingle(),
      'lettura della lista di A'
    )
    // Se la lista comune è di B, per separarli dovrebbe uscire A: cioè una
    // sentinella lascerebbe la propria lista personale.
    check(list.created_by === a.userId, 'A e B condividono una lista che non è di A: il ripristino non scrive')
  }

  const category = must(
    await a.client.from('categories').select('id').eq('name', KNOWN_CATEGORY_NAME).maybeSingle(),
    'lettura della categoria dei dati noti'
  )

  // --- Scritture.
  if (listsOfA.length === 0) await createPersonalList(a, 'A')

  if (shared) {
    // Come fa il client: `leave_list()` toglie B e gli crea la lista personale (#184).
    const rows = must(await b.client.rpc('leave_list'), 'uscita di B dalla lista di A')
    const row = Array.isArray(rows) ? rows[0] : rows
    check(row?.success === true, 'uscita di B dalla lista di A')
  } else if (listsOfB.length === 0) {
    await createPersonalList(b, 'B')
  }

  const [listOfA] = await listIdsOf(a, 'A')
  const [listOfB] = await listIdsOf(b, 'B')
  check(listOfA && listOfB && listOfA !== listOfB, 'A e B non hanno due liste distinte dopo il ripristino')

  mustSucceed(await b.client.from('foods').delete().eq('list_id', listOfB), 'pulizia degli alimenti di B')
  await emptyFolder(b, 'B')

  const knownIds = KNOWN_FOODS.map((food) => food.id)
  mustSucceed(
    await a.client.from('foods').delete().eq('list_id', listOfA).not('id', 'in', `(${knownIds.join(',')})`),
    'pulizia degli alimenti estranei di A'
  )

  const names = await emptyFolder(a, 'A', KNOWN_PHOTO_NAME)
  if (!names.includes(KNOWN_PHOTO_NAME)) {
    must(
      await a.client.storage
        .from(BUCKET)
        .upload(knownPhotoPath(a.userId), KNOWN_PHOTO_BYTES, { contentType: 'image/jpeg' }),
      'caricamento della foto nota'
    )
  }

  // `updated_at` lo scrive un trigger con l'ora del server. Se la scrittura
  // scavalca la mezzanotte di Roma, le date sono di ieri e `updated_at` di
  // oggi: il controllo lo vede, e si riscrive una volta.
  for (let attempt = 0; ; attempt++) {
    await writeKnownFoods(a, listOfA, category.id, romeDay(new Date()))
    const problems = checkKnownFoods(await knownFoodRows(a, listOfA), a.userId)
    if (problems.length === 0) break
    if (attempt === 1) fail(`dati noti non a posto dopo il ripristino: ${problems.join('; ')}`)
  }

  return { bLeftListOfA: shared }
}
