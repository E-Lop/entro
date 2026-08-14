// @vitest-environment jsdom
/**
 * Nessun segreto nella console.
 *
 * Il controllo che questo test sostituisce — rileggere le chiamate a
 * `console.*` a occhio — è esattamente quello che aveva lasciato passare il
 * difetto: quasi nessun punto stampa un segreto direttamente, lo stampa di
 * rimbalzo. `console.error('contesto:', error)` stampa anche le *proprietà*
 * dell'errore, e i client Supabase ci attaccano i dati della risposta,
 * inclusa la sessione che stavano tentando di rinnovare.
 *
 * Quindi qui non si legge il codice: si eseguono i flussi con valori
 * sentinella e si guarda cosa esce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** Un JWT nella forma reale: tre segmenti base64url, il primo apre con `eyJ`. */
const TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const REFRESH_TOKEN = 'eyJyZWZyZXNoIjoidG9rZW4ifQ.eyJleHAiOjk5OTk5OTk5fQ.Kx8sPqWvT2mNbYcR4hL7dGfZ1aE0uJ3iO5nQ'
// Nessun flusso qui sotto passa una password: oggi questa sentinella non può
// far fallire niente. Resta nell'elenco perché il giorno in cui si aggiunge un
// flusso che ne maneggia una, il controllo c'è già.
const PASSWORD = 'PasswordSegretissima!2026'
/** Sei caratteri alfanumerici, come i codici veri (`ABC123`). */
const INVITE_CODE = 'ZK7Q2M'

const SENTINELS = [TOKEN, REFRESH_TOKEN, PASSWORD, INVITE_CODE]

/**
 * Un `image_url` all'antica: in DB alcune righe tengono l'URL firmato intero
 * invece del solo percorso d'archivio, e un URL firmato di Supabase Storage
 * porta il token **nella query**. È il valore che `getSignedImageUrls` passa a
 * `getSignedImageUrl`, e che finiva interpolato nel messaggio di errore.
 */
const LEGACY_SIGNED_URL = `https://rmbmmwcxtnanacxbkihc.supabase.co/storage/v1/object/sign/food-images/utente/foto.jpg?token=${TOKEN}`

const { mockAuth, mockRpc, mockCreateSignedUrl } = vi.hoisted(() => ({
  mockAuth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
  mockRpc: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: mockAuth,
    rpc: mockRpc,
    storage: { from: () => ({ createSignedUrl: mockCreateSignedUrl }) },
  },
}))

import { getCurrentUser, getSession } from '@/lib/auth'
import { registerPendingInvite } from '@/lib/invites'
import { getSignedImageUrl, getSignedImageUrls } from '@/lib/storage'
import { redactSecrets, redactUrl, logError } from '@/lib/safeLog'

const METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const

let captured: string[]

/**
 * Serializza come farebbe una console vera: di un `Error` mostra il messaggio
 * *e* le proprietà, che è il punto in cui i segreti escono di rimbalzo.
 */
function serialize(value: unknown): string {
  if (value instanceof Error) {
    return `${value.message} ${JSON.stringify({ ...value })}`
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

beforeEach(() => {
  captured = []
  for (const method of METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      captured.push(args.map(serialize).join(' '))
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

/** Tutto quello che è finito in console, in un'unica stringa. */
function output(): string {
  return captured.join('\n')
}

function expectNoSentinels(): void {
  const logged = output()
  for (const sentinel of SENTINELS) {
    expect(logged).not.toContain(sentinel)
  }
}

/** Un errore Supabase come arriva davvero: con la sessione appesa addosso. */
function supabaseErrorWithSession(message: string): Error {
  return Object.assign(new Error(message), {
    status: 400,
    session: { access_token: TOKEN, refresh_token: REFRESH_TOKEN },
  })
}

describe('redactSecrets', () => {
  it('toglie un JWT da una stringa', () => {
    expect(redactSecrets(`token=${TOKEN}`)).not.toContain(TOKEN)
  })

  it('lascia in piedi gli host, che non sono segreti', () => {
    // Un pattern «tre segmenti separati da punto» senza il prefisso `eyJ`
    // colpirebbe anche questo, e un log che cancella a caso smette di servire
    // a diagnosticare.
    const host = 'rmbmmwcxtnanacxbkihc.functions.supabase.co'
    expect(redactSecrets(`fetch fallita su ${host}`)).toContain(host)
  })

  it('lascia in piedi un dominio normale', () => {
    expect(redactSecrets('errore su entroapp.it')).toContain('entroapp.it')
  })

  it('toglie più token dalla stessa stringa', () => {
    const redatto = redactSecrets(`a=${TOKEN} b=${REFRESH_TOKEN}`)
    expect(redatto).not.toContain(TOKEN)
    expect(redatto).not.toContain(REFRESH_TOKEN)
  })

  it('non tocca una stringa senza segreti', () => {
    const message = 'Session from session_id claim in JWT does not exist'
    expect(redactSecrets(message)).toBe(message)
  })
})

describe('redactUrl', () => {
  it('butta il frammento, dove Supabase mette i parametri di sessione', () => {
    const href = `https://entroapp.it/dashboard#access_token=${TOKEN}&refresh_token=opaco-non-jwt&type=magiclink`

    const redatto = redactUrl(href)

    expect(redatto).toBe('https://entroapp.it/dashboard')
    expect(redatto).not.toContain(TOKEN)
    // Il refresh token di Supabase è opaco: non ha la forma di un JWT e
    // nessun pattern lo intercetterebbe. Per questo si butta tutto il
    // frammento invece di ripulirlo.
    expect(redatto).not.toContain('opaco-non-jwt')
  })

  it('butta anche la query', () => {
    expect(redactUrl(`https://entroapp.it/signup?code=${INVITE_CODE}`)).toBe(
      'https://entroapp.it/signup'
    )
  })

  it('tiene origine e percorso, che sono il motivo per cui si logga l\'URL', () => {
    const href = 'https://entroapp.it/reset-password'
    expect(redactUrl(href)).toBe(href)
  })

  it('non solleva su un URL malformato', () => {
    expect(redactUrl('non-un-url')).toBe('[url non valido]')
  })
})

describe('logError', () => {
  it('non stampa le proprietà dell\'errore, dove si nasconde la sessione', () => {
    logError('[test] contesto:', supabaseErrorWithSession('Token refresh fallito'))

    expect(output()).toContain('Token refresh fallito')
    expectNoSentinels()
  })

  it('redige un token che sta nel messaggio stesso', () => {
    logError('[test] contesto:', new Error(`Refresh fallito per ${TOKEN}`))
    expectNoSentinels()
  })

  it('regge un valore che non è un Error', () => {
    logError('[test] contesto:', { access_token: TOKEN })
    expectNoSentinels()
  })

  it('mantiene il contesto, che è il motivo per cui si logga', () => {
    logError('[authStore] Errore:', new Error('qualcosa'))
    expect(output()).toContain('[authStore] Errore:')
  })
})

describe('flussi auth — niente segreti in console', () => {
  it('getCurrentUser con errore che si porta dietro la sessione', async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: supabaseErrorWithSession('Errore nel recupero utente'),
    })

    await getCurrentUser()

    expectNoSentinels()
  })

  it('getCurrentUser quando la chiamata solleva', async () => {
    mockAuth.getUser.mockRejectedValue(supabaseErrorWithSession('Boom'))

    await getCurrentUser()

    expectNoSentinels()
  })

  it('getSession con errore che si porta dietro la sessione', async () => {
    // Qui il token deve stare anche nel *messaggio*: `getSession` rimpacchetta
    // l'errore in un `new Error(error.message)`, quindi le proprietà si
    // perdono per strada e un test che guardasse solo quelle passerebbe a
    // vuoto, provando la protezione accidentale invece del redattore.
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: supabaseErrorWithSession(`Refresh fallito per ${TOKEN}`),
    })

    await getSession()

    expectNoSentinels()
  })

  it('getSession quando la chiamata solleva', async () => {
    mockAuth.getSession.mockRejectedValue(supabaseErrorWithSession('Boom'))

    await getSession()

    expectNoSentinels()
  })
})

describe('flusso invito — il codice non finisce in console', () => {
  it('registerPendingInvite con un messaggio del server che contiene il codice', async () => {
    // `register_pending_invite` riceve il codice fra i parametri: un
    // `RAISE EXCEPTION` che lo interpola lo porta nel messaggio. Qui non
    // basta redigere — il segreto *è* il messaggio — quindi il messaggio del
    // server non va stampato affatto.
    mockRpc.mockResolvedValue({
      error: new Error(`invito ${INVITE_CODE} già utilizzato`),
    })

    await registerPendingInvite(INVITE_CODE, 'utente@example.com')

    expectNoSentinels()
  })

  it('registerPendingInvite quando la chiamata solleva col codice nel messaggio', async () => {
    mockRpc.mockRejectedValue(new Error(`invito ${INVITE_CODE} non valido`))

    await registerPendingInvite(INVITE_CODE, 'utente@example.com')

    expectNoSentinels()
  })
})

describe('flusso signed URL — il token non finisce in console', () => {
  it('getSignedImageUrl con un errore che si porta dietro la sessione', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: supabaseErrorWithSession('Errore interno del server'),
    })

    await expect(getSignedImageUrl('utente/foto.jpg')).rejects.toThrow()

    expectNoSentinels()
  })

  it('getSignedImageUrls non interpola nel messaggio il percorso, che può essere un URL firmato', async () => {
    // Qui il segreto non arriva dall'errore: arriva dal *percorso*. Alcune
    // righe in DB tengono l'URL firmato intero come `image_url`, e quel valore
    // finiva interpolato nel contesto del log — token nella query compreso.
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: supabaseErrorWithSession('Errore interno del server'),
    })

    const urls = await getSignedImageUrls([LEGACY_SIGNED_URL])

    expect(urls.size).toBe(0)
    expectNoSentinels()
  })

  it('getSignedImageUrls tiene il percorso normale nel log, che è il motivo per cui lo si logga', async () => {
    // Redigere è utile finché non cancella la diagnosi: un percorso d'archivio
    // non è un URL e deve restare leggibile.
    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: new Error('Errore interno del server'),
    })

    await getSignedImageUrls(['utente/foto.jpg'])

    expect(output()).toContain('utente/foto.jpg')
  })
})

describe('flusso push — il token non finisce in console', () => {
  /**
   * `subscribeToPush` gira solo con Push API, service worker e permesso
   * notifiche presenti: qui si montano i minimi indispensabili perché il flusso
   * arrivi davvero fino alla `subscribe` che fallisce.
   */
  async function loadPushWithFailingSubscribe(failure: Error) {
    vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U')
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn().mockResolvedValue('granted') })
    vi.stubGlobal('navigator', {
      onLine: true,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      maxTouchPoints: 0,
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { subscribe: vi.fn().mockRejectedValue(failure) } }),
      },
    })
    vi.resetModules()
    return import('@/lib/pushNotifications')
  }

  it('subscribeToPush quando la subscribe fallisce con la sessione appesa addosso', async () => {
    const { subscribeToPush } = await loadPushWithFailingSubscribe(
      supabaseErrorWithSession('Registrazione push rifiutata')
    )

    const result = await subscribeToPush()

    expect(result.success).toBe(false)
    expectNoSentinels()
  })

  it('subscribeToPush quando il token sta nel messaggio stesso', async () => {
    const { subscribeToPush } = await loadPushWithFailingSubscribe(
      new Error(`Registrazione push rifiutata per ${TOKEN}`)
    )

    await subscribeToPush()

    expectNoSentinels()
  })
})
