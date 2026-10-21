/**
 * Semina l'utente canonico sul Supabase **locale**: lo crea se manca, e gli
 * riscrive gli alimenti dal seme del bundle di famiglia (#234).
 *
 *   npm run seed:local                 utente tenuto, alimenti riscritti
 *   npm run seed:local -- --recreate   utente cancellato e ricreato, con le sue foto
 *
 * Il contratto sta in `entro-family/conventions/test-data.md`: l'indirizzo
 * dell'utente canonico, e le undici righe di `test-data-seed.json` con il
 * perché di ciascuna. Le date sono contate dal giorno di oggi a Roma, come i
 * dati noti della suite smoke.
 *
 * Di default l'utente resta lo stesso: un utente ricreato invalida le sessioni
 * aperte sui simulatori e nei browser, e per riavere i badge di oggi basta
 * riscrivere gli alimenti. `--recreate` serve quando l'utente stesso è da
 * rifare, e porta via anche le foto della sua cartella: cancellare un utente
 * non cancella i suoi oggetti nel bucket (entro-mobile#200).
 *
 * ⚠️ È uno strumento di sviluppo. La guardia degli helper E2E (#186) lo ferma
 * prima di creare un client se URL o chiave non sono quelli locali, e si
 * scavalcano solo con le stesse variabili degli helper.
 *
 * Serve Node ≥ 22.18, che esegue i file TypeScript senza build, come
 * `npm run db:prepush`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  adminClient,
  createE2EUser,
  createListForUser,
  E2E_PASSWORD,
  findUserByEmail,
  listE2EFoodImages,
  removeE2EFoodImages,
  signInAsUser,
} from '../../tests/e2e/helpers/supabase.ts'
import { romeDay } from '../../tests/smoke/calendarDay.ts'
import { parseSeed, seedExpiryDate, type SeedFood } from './seedRows.ts'

/** L'utente canonico locale: il modello del ruolo in `conventions/test-data.md`. */
export const CANONICAL_EMAIL = 'e2e@example.test'

const REPO = resolve(fileURLToPath(import.meta.url), '..', '..', '..')

/** Il seme dal bundle affiancato, o dalla cartella in `ENTRO_FAMILY_DIR`. */
function readBundleSeed(): SeedFood[] {
  const bundle = process.env.ENTRO_FAMILY_DIR
    ? resolve(process.env.ENTRO_FAMILY_DIR)
    : join(REPO, '..', 'entro-family')
  const path = join(bundle, 'conventions', 'test-data-seed.json')
  if (!existsSync(path)) {
    throw new Error(
      `seme non trovato in ${path}. Clona \`E-Lop/entro-family\` affiancato a questo repo, ` +
        'oppure indica la cartella con ENTRO_FAMILY_DIR.'
    )
  }
  return parseSeed(readFileSync(path, 'utf8'))
}

/** I percorsi d'archivio fra gli `image_url`: le foto della cartella dell'utente. */
function ownPhotoPaths(imageUrls: readonly (string | null)[], userId: string): string[] {
  return imageUrls.filter((url): url is string => url?.startsWith(`${userId}/`) ?? false)
}

/** L'utente canonico, creato se manca e ricreato se richiesto. */
async function canonicalUser(recreate: boolean): Promise<string> {
  const existing = await findUserByEmail(CANONICAL_EMAIL)

  if (existing && !recreate) {
    console.log(`utente ${CANONICAL_EMAIL} tenuto`)
    return existing.id
  }

  if (existing) {
    // Gli alimenti prima dell'utente: una lista condivisa sopravvive a chi la
    // lascia cancellando l'account (#152), e chi resta erediterebbe il seme.
    // Successo il 21 ott 2026 sul canonico, in lista con due utenti d'invito.
    const foods = await removeFoods(existing.id)
    const photos = await listE2EFoodImages(existing.id)
    await removeE2EFoodImages(photos)
    console.log(
      `utente ${CANONICAL_EMAIL} cancellato, con ${foods} alimenti e ${photos.length} altre foto della sua cartella`
    )
  }

  const { id } = await createE2EUser(CANONICAL_EMAIL, E2E_PASSWORD)
  console.log(`utente ${CANONICAL_EMAIL} creato`)
  return id
}

/** Toglie gli alimenti dell'utente, e le foto che portavano: nessuno le leggerebbe più. */
async function removeFoods(userId: string): Promise<number> {
  const { data, error } = await adminClient.from('foods').delete().eq('user_id', userId).select('image_url')
  if (error) throw new Error(`non riesco a togliere gli alimenti precedenti: ${error.message}`)
  await removeE2EFoodImages(ownPhotoPaths(data.map((row) => row.image_url), userId))
  return data.length
}

async function seed(recreate: boolean): Promise<void> {
  const foods = readBundleSeed()
  const userId = await canonicalUser(recreate)

  // Dalla entro#94 la lista personale la crea un trigger: qui la si ritrova.
  // Senza `list_id` la riga resterebbe invisibile all'utente, perché la policy
  // di lettura di `foods` passa da `list_members`.
  const listId = await createListForUser(userId)

  const { data: categories, error: categoriesError } = await adminClient.from('categories').select('id, name')
  if (categoriesError) throw new Error(`non riesco a leggere le categorie: ${categoriesError.message}`)
  // Per nome: gli id sono generati e cambiano da un database all'altro.
  const categoryId = new Map(categories.map((c) => [c.name, c.id]))
  const missing = [...new Set(foods.map((f) => f.category))].filter((name) => !categoryId.has(name))
  if (missing.length > 0) throw new Error(`categorie assenti nel database: ${missing.join(', ')}`)

  console.log(`tolti ${await removeFoods(userId)} alimenti precedenti`)

  const today = romeDay(new Date())
  const { error: insertError } = await adminClient.from('foods').insert(
    foods.map((food) => ({
      user_id: userId,
      list_id: listId,
      name: food.name,
      category_id: categoryId.get(food.category),
      storage_location: food.storage,
      quantity: food.quantity,
      quantity_unit: food.unit,
      expiry_date: seedExpiryDate(food, today),
      notes: food.notes ?? null,
      status: 'active',
    }))
  )
  if (insertError) throw new Error(`non riesco a scrivere il seme: ${insertError.message}`)

  // Riletti dalla porta dell'app: la sessione dell'utente e la chiave
  // anonima, quindi con la RLS. Scritte non vuol dire visibili.
  const asUser = await signInAsUser(CANONICAL_EMAIL, E2E_PASSWORD)
  const { count, error: countError } = await asUser
    .from('foods')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (countError) throw new Error(`la rilettura come utente è fallita: ${countError.message}`)
  if (count !== foods.length) {
    throw new Error(`scritti ${foods.length} alimenti, ma l'utente ne vede ${count}: controlla la sua lista`)
  }

  console.log(`seminati ${foods.length} alimenti, riletti come ${CANONICAL_EMAIL} con la RLS (oggi ${today}):`)
  for (const food of foods) {
    console.log(`  ${food.name.padEnd(22)} ${seedExpiryDate(food, today)}  ${food.expiryStatus}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await seed(process.argv.includes('--recreate'))
  } catch (error) {
    console.error(`errore: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
