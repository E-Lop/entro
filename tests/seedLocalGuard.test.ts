/**
 * Lo script del seme parla solo col Supabase locale (#234).
 *
 * Cancella e ricrea l'utente canonico con la chiave `service_role`, e prende
 * URL e chiave dall'ambiente come gli helper E2E, da cui passa: chi ha appena
 * lavorato in produzione può avere quelle variabili ancora esportate. La guardia
 * è la stessa degli helper (#186), e qui si prova che lo script la attraversa
 * **prima** di creare un client.
 *
 * Si importa il modulo, invece di lanciarlo con Node: la CI usa Node 20, che
 * non esegue un file `.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCAL_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './e2e/helpers/localSupabase'

const createClient = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  createClient.mockClear()
})

describe('lo script del seme', () => {
  it.each([
    ['un progetto Supabase', 'https://abcdefghijklmnop.supabase.co', LOCAL_SERVICE_ROLE_KEY, /solo sul Supabase locale/],
    ['una chiave che non è quella demo', LOCAL_SUPABASE_URL, 'una-chiave-vera-qualunque', /non è quella demo/],
  ])('rifiuta %s, senza creare un client', async (_, url, key, message) => {
    vi.stubEnv('E2E_SUPABASE_URL', url)
    vi.stubEnv('E2E_SUPABASE_SERVICE_ROLE_KEY', key)

    await expect(import('../scripts/test-data/seed.ts')).rejects.toThrow(message)
    expect(createClient).not.toHaveBeenCalled()
  })
})
