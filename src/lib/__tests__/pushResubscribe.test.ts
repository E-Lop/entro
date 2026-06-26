import { describe, it, expect, vi } from 'vitest'
import { resubscribeOnChange } from '../pushResubscribe'

function fakeClients(clients: Array<{ postMessage: ReturnType<typeof vi.fn> }>) {
  return { matchAll: vi.fn().mockResolvedValue(clients) }
}

function makeClient() {
  return { postMessage: vi.fn() }
}

describe('resubscribeOnChange', () => {
  it('ri-sottoscrive con le opzioni precedenti e notifica i client aperti', async () => {
    const options = { userVisibleOnly: true, applicationServerKey: 'KEY' }
    const newSub = { toJSON: () => ({ endpoint: 'https://push/new' }) }
    const pushManager = { subscribe: vi.fn().mockResolvedValue(newSub) }
    const client = makeClient()
    const clients = fakeClients([client])

    await resubscribeOnChange(pushManager, { oldSubscription: { options, toJSON: () => ({}) } }, clients)

    expect(pushManager.subscribe).toHaveBeenCalledWith(options)
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      subscription: { endpoint: 'https://push/new' },
    })
  })

  it('usa la chiave VAPID di fallback quando manca oldSubscription (caso Firefox)', async () => {
    const newSub = { toJSON: () => ({ endpoint: 'https://push/ff' }) }
    const pushManager = { subscribe: vi.fn().mockResolvedValue(newSub) }
    const clients = fakeClients([])

    await resubscribeOnChange(pushManager, {}, clients, 'VAPID_FALLBACK')

    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: 'VAPID_FALLBACK',
    })
  })

  it('usa direttamente newSubscription se il browser la fornisce, senza ri-sottoscrivere', async () => {
    const pushManager = { subscribe: vi.fn() }
    const client = makeClient()
    const clients = fakeClients([client])
    const newSubscription = { toJSON: () => ({ endpoint: 'https://push/provided' }), options: {} }

    await resubscribeOnChange(pushManager, { newSubscription }, clients)

    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'PUSH_SUBSCRIPTION_CHANGED',
      subscription: { endpoint: 'https://push/provided' },
    })
  })

  it('degrada senza lanciare quando la ri-sottoscrizione fallisce', async () => {
    const pushManager = { subscribe: vi.fn().mockRejectedValue(new Error('denied')) }
    const client = makeClient()
    const clients = fakeClients([client])

    await expect(
      resubscribeOnChange(pushManager, { oldSubscription: { options: { userVisibleOnly: true }, toJSON: () => ({}) } }, clients)
    ).resolves.toBeUndefined()
    expect(client.postMessage).not.toHaveBeenCalled()
  })

  it('non fa nulla se non ci sono opzioni né fallback disponibili', async () => {
    const pushManager = { subscribe: vi.fn() }
    const client = makeClient()
    const clients = fakeClients([client])

    await resubscribeOnChange(pushManager, {}, clients)

    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(client.postMessage).not.toHaveBeenCalled()
  })
})
