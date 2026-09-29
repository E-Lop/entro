/**
 * Livello (c): inviti fra le sentinelle (#187).
 *
 * A ottiene un codice, B aderisce, vedono la stessa lista, B esce come fa il
 * client. **Mai `accept-invite`** (#183). Gli errori delle RPC non arrivano
 * come HTTP ma come `success = false`: si controlla `success`.
 *
 * Se il livello si ferma con B ancora nella lista di A, il prossimo ripristino
 * lo fa uscire.
 */
import { beforeAll, describe, it } from 'vitest'
import { signIn, type Sentinel } from './env'
import { check, must } from './failure'
import { KNOWN_FOODS } from './knownFoods'
import { listIdsOf } from './restore'

interface RpcResult {
  success: boolean
  list_id: string | null
}

function firstRow(data: unknown): RpcResult | undefined {
  return (Array.isArray(data) ? data[0] : data) as RpcResult | undefined
}

describe('livello c', () => {
  let a: Sentinel
  let b: Sentinel
  let listOfA: string
  let shortCode: string

  beforeAll(async () => {
    a = await signIn('A')
    b = await signIn('B')
    const lists = await listIdsOf(a, 'A')
    check(lists.length === 1, 'A non ha esattamente una lista')
    listOfA = lists[0]
  })

  it('A ottiene un invito valido', async () => {
    // Un invito pending ancora valido si riusa: gli inviti non si possono
    // chiudere né cancellare finché non arriva la #194, e così non si accumulano.
    const soon = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    const pending = must(
      await a.client
        .from('invites')
        .select('short_code')
        .eq('list_id', listOfA)
        .eq('status', 'pending')
        .gt('expires_at', soon)
        .not('short_code', 'is', null)
        .limit(1),
      'lettura degli inviti di A'
    )
    if (pending.length > 0) {
      shortCode = pending[0].short_code as string
      return
    }
    const created = must(
      await a.client.functions.invoke<{ success: boolean; shortCode: string }>('create-invite', {
        body: { listId: listOfA },
      }),
      'create-invite non ha creato l\'invito'
    )
    check(created.success === true && typeof created.shortCode === 'string', 'create-invite non ha restituito un codice')
    shortCode = created.shortCode
  })

  it('B aderisce con join_list_via_invite', async () => {
    const data = must(
      await b.client.rpc('join_list_via_invite', { p_short_code: shortCode, p_force: true }),
      'join_list_via_invite in errore'
    )
    const row = firstRow(data)
    check(row?.success === true, 'join_list_via_invite: success = false')
    check(row.list_id === listOfA, 'B non è entrato nella lista di A')
  })

  it('B vede gli alimenti noti di A', async () => {
    const rows = must(await b.client.from('foods').select('id').eq('list_id', listOfA), 'lettura degli alimenti da B')
    const seen = new Set(rows.map((row) => row.id))
    check(KNOWN_FOODS.every((food) => seen.has(food.id)), 'B non vede gli alimenti noti di A')
  })

  it('get_shared_list_member_ids() di A include B', async () => {
    const rows = must(await a.client.rpc('get_shared_list_member_ids'), 'get_shared_list_member_ids() in errore')
    const ids = (rows as { user_id: string }[]).map((row) => row.user_id)
    check(ids.includes(b.userId), 'get_shared_list_member_ids() di A non include B')
  })

  it('B esce come fa il client, e torna ad avere solo la propria lista', async () => {
    // Come `leaveSharedList()`: una chiamata sola a `leave_list()` (#184).
    const left = firstRow(must(await b.client.rpc('leave_list'), 'leave_list in errore'))
    check(left?.success === true, 'leave_list: success = false')

    const listsOfB = await listIdsOf(b, 'B')
    check(listsOfB.length === 1 && listsOfB[0] !== listOfA, 'B non ha una sola lista, la propria')
    const members = must(
      await a.client.from('list_members').select('user_id').eq('list_id', listOfA),
      'lettura dei membri della lista di A'
    )
    check(members.length === 1 && members[0].user_id === a.userId, 'la lista di A non ha un solo membro')
  })
})
