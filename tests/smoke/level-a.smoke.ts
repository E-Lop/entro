/**
 * Livello (a): lettura, e nessuna scrittura (#187).
 *
 * È il livello che durante la #179 sarebbe diventato rosso: le funzioni della
 * RLS rispondevano 42P01, e ogni lettura di `lists` e `foods` falliva.
 */
import { beforeAll, describe, it } from 'vitest'
import { signIn, type Sentinel } from './env'
import { check, fail, must } from './failure'
import { checkKnownFoods, knownPhotoPath } from './knownFoods'
import { BUCKET, knownFoodRows, listIdsOf } from './restore'

describe('livello a', () => {
  let a: Sentinel
  let listOfA: string

  beforeAll(async () => {
    a = await signIn('A')
  })

  it('A ha esattamente una lista, e la legge', async () => {
    const lists = await listIdsOf(a, 'A')
    check(lists.length === 1, 'A non ha esattamente una lista')
    listOfA = lists[0]
    must(await a.client.from('lists').select('id').eq('id', listOfA).maybeSingle(), 'lista di A non leggibile')
  })

  it('get_user_list_ids() restituisce la lista di A', async () => {
    const rows = must(await a.client.rpc('get_user_list_ids'), 'get_user_list_ids() in errore')
    const ids = (rows as { list_id: string }[]).map((row) => row.list_id)
    check(ids.length === 1 && ids[0] === listOfA, 'get_user_list_ids() non restituisce la lista di A')
  })

  it('get_shared_list_member_ids() restituisce A e nessun altro', async () => {
    const rows = must(await a.client.rpc('get_shared_list_member_ids'), 'get_shared_list_member_ids() in errore')
    const ids = (rows as { user_id: string }[]).map((row) => row.user_id)
    check(ids.length === 1 && ids[0] === a.userId, 'get_shared_list_member_ids() non restituisce solo A')
  })

  it('la lista contiene esattamente i cinque alimenti noti, con le date e gli stati attesi', async () => {
    const problems = checkKnownFoods(await knownFoodRows(a, listOfA), a.userId)
    if (problems.length > 0) fail(problems.join('; '))
  })

  it('la foto nota si scarica da un URL firmato', async () => {
    const signed = must(
      await a.client.storage.from(BUCKET).createSignedUrl(knownPhotoPath(a.userId), 60),
      'URL firmato della foto nota non ottenuto'
    )
    let response: Response
    try {
      response = await fetch(signed.signedUrl)
    } catch {
      fail('foto nota non scaricabile')
    }
    check(response.status === 200, 'foto nota non scaricabile')
    check(response.headers.get('content-type')?.startsWith('image/'), 'la foto nota non è un\'immagine')
  })
})
