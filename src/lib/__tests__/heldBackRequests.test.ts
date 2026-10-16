/**
 * Una richiesta trattenuta mette in pausa React Query come una rete assente,
 * e il rinnovo del token la toglie (#229).
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { onlineManager } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { declareSignedInCheck } from '../sessionBoundFetch'
import {
  declareSessionCheck,
  heldBackSessionError,
  holdUntilTokenRefreshed,
  isHeldBackRequest,
  pausingOnHeldBack,
  releaseOnAuthEvent,
} from '../heldBackRequests'

const HELD_BACK = new TypeError('Request held back: no session token available')

afterEach(() => {
  // Lo stato del modulo si azzera rilasciando; onlineManager torna online.
  releaseOnAuthEvent('SIGNED_OUT')
  onlineManager.setOnline(true)
  vi.unstubAllGlobals()
})

describe('riconoscere una richiesta trattenuta', () => {
  it('nelle tre forme in cui arriva', () => {
    expect(isHeldBackRequest(HELD_BACK)).toBe(true)
    // postgrest-js
    expect(isHeldBackRequest({ message: `TypeError: ${HELD_BACK.message}`, code: '' })).toBe(true)
    // storage-js
    expect(isHeldBackRequest({ name: 'StorageUnknownError', message: HELD_BACK.message, originalError: HELD_BACK })).toBe(true)
  })

  it('e non un errore di rete qualunque, né un rifiuto del server', () => {
    expect(isHeldBackRequest(new TypeError('Failed to fetch'))).toBe(false)
    expect(isHeldBackRequest({ message: 'TypeError: Failed to fetch', code: '' })).toBe(false)
    expect(isHeldBackRequest({ message: 'permission denied for table foods', code: '42501' })).toBe(false)
    expect(isHeldBackRequest({ originalError: new TypeError('Failed to fetch') })).toBe(false)
    expect(isHeldBackRequest(undefined)).toBe(false)
  })
})

describe('la pausa', () => {
  it('una richiesta trattenuta mette React Query offline', async () => {
    const fetchImpl = pausingOnHeldBack(async () => {
      throw HELD_BACK
    })

    await expect(fetchImpl('https://probe/rest/v1/foods')).rejects.toBe(HELD_BACK)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('un errore di rete qualunque non tocca lo stato di React Query', async () => {
    const fetchImpl = pausingOnHeldBack(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(fetchImpl('https://probe/rest/v1/foods')).rejects.toThrow('Failed to fetch')
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('il rinnovo del token la toglie, e si torna allo stato della rete del browser', () => {
    holdUntilTokenRefreshed()
    releaseOnAuthEvent('TOKEN_REFRESHED')
    expect(onlineManager.isOnline()).toBe(true)

    vi.stubGlobal('navigator', { onLine: false })
    holdUntilTokenRefreshed()
    releaseOnAuthEvent('TOKEN_REFRESHED')
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('anche l’uscita la toglie: chi non è dentro non ha richieste trattenute', () => {
    holdUntilTokenRefreshed()
    releaseOnAuthEvent('SIGNED_OUT')
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('gli altri eventi di autenticazione non la toccano', () => {
    holdUntilTokenRefreshed()
    releaseOnAuthEvent('INITIAL_SESSION')
    releaseOnAuthEvent('USER_UPDATED')
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('senza una pausa in corso, il rinnovo non cambia lo stato di React Query', () => {
    // Non è compito di questo modulo dire online a un browser offline.
    onlineManager.setOnline(false)
    releaseOnAuthEvent('TOKEN_REFRESHED')
    expect(onlineManager.isOnline()).toBe(false)
  })
})

describe('la sessione che manca per rete, con un utente dentro', () => {
  // auth-js, a rinnovo fallito per rete, non toglie la sessione e restituisce
  // `session: null` con un `AuthRetryableFetchError` (`_callRefreshToken`).
  const networkError = new AuthRetryableFetchError('Failed to fetch', 0)

  afterEach(() => declareSignedInCheck(() => false))

  it('è una richiesta trattenuta: mette in pausa e dà l’errore che la coda riconosce', () => {
    declareSignedInCheck(() => true)

    const error = heldBackSessionError(networkError)

    expect(isHeldBackRequest(error)).toBe(true)
    expect(onlineManager.isOnline()).toBe(false)
  })

  it('senza nessuno dentro, o per un altro errore, resta quello che era', () => {
    declareSignedInCheck(() => false)
    expect(heldBackSessionError(networkError)).toBeNull()

    declareSignedInCheck(() => true)
    expect(heldBackSessionError(null)).toBeNull()
    expect(heldBackSessionError(new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'))).toBeNull()
    expect(onlineManager.isOnline()).toBe(true)
  })
})

describe('il rinnovo riuscito mentre la richiesta falliva', () => {
  // Misurato il 16 ott 2026 nell'E2E: la scrittura riceve l'esito del giro di
  // rinnovo fallito *dopo* che un giro nuovo è riuscito, quindi la pausa
  // scatta dopo l'ultimo `TOKEN_REFRESHED`, e nessuno la toglierebbe più.
  afterEach(() => declareSessionCheck(async () => false))

  it('se alla pausa la sessione è già tornata, la pausa si toglie subito', async () => {
    declareSessionCheck(async () => true)

    holdUntilTokenRefreshed()

    await vi.waitFor(() => expect(onlineManager.isOnline()).toBe(true))
  })

  it('se la sessione non è tornata, la pausa resta fino al rinnovo', async () => {
    declareSessionCheck(async () => false)

    holdUntilTokenRefreshed()
    await Promise.resolve()
    await Promise.resolve()

    expect(onlineManager.isOnline()).toBe(false)
    releaseOnAuthEvent('TOKEN_REFRESHED')
    expect(onlineManager.isOnline()).toBe(true)
  })

  it('se il controllo fallisce, la pausa resta e niente esplode', async () => {
    declareSessionCheck(async () => {
      throw new Error('rete')
    })

    holdUntilTokenRefreshed()
    await Promise.resolve()
    await Promise.resolve()

    expect(onlineManager.isOnline()).toBe(false)
  })
})

describe('un controllo vecchio non toglie una pausa nuova', () => {
  // Segnalato da CodeRabbit sulla PR #238: il controllo di una pausa già tolta
  // da un evento può rispondere dopo che è scattata la pausa successiva.
  afterEach(() => declareSessionCheck(async () => false))

  it('il controllo della prima pausa non toglie la seconda', async () => {
    let answerFirst: (back: boolean) => void = () => {}
    declareSessionCheck(() => new Promise<boolean>((resolve) => (answerFirst = resolve)))
    holdUntilTokenRefreshed()

    releaseOnAuthEvent('TOKEN_REFRESHED')
    declareSessionCheck(async () => false)
    holdUntilTokenRefreshed()

    answerFirst(true)
    await Promise.resolve()
    await Promise.resolve()

    expect(onlineManager.isOnline()).toBe(false)
  })
})
