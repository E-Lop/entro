/**
 * Gli helper E2E parlano solo col Supabase locale (#186).
 *
 * Creano e cancellano utenti con la chiave `service_role`, e prendono URL e
 * chiave dall'ambiente. Chi ha appena lavorato in produzione può avere quelle
 * variabili ancora esportate: senza guardia la suite scriverebbe là.
 *
 * Sta fuori da `tests/e2e/` perché vitest esclude quella cartella, e importa il
 * modulo della guardia, non `supabase.ts`: questo test non deve creare client.
 */
import { describe, expect, it } from 'vitest'
import { assertLocalSupabase, LOCAL_SERVICE_ROLE_KEY } from './e2e/helpers/localSupabase'

describe('assertLocalSupabase', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://[::1]:54321',
  ])('accetta %s con la chiave demo', (url) => {
    expect(() => assertLocalSupabase(url, LOCAL_SERVICE_ROLE_KEY)).not.toThrow()
  })

  it.each([
    ['un progetto Supabase', 'https://abcdefghijklmnop.supabase.co'],
    ['un host che comincia come quello locale', 'http://127.0.0.1.evil.example:54321'],
    ['credenziali che fingono un host locale', 'http://localhost@evil.example:54321'],
  ])('rifiuta %s', (_, url) => {
    expect(() => assertLocalSupabase(url, LOCAL_SERVICE_ROLE_KEY)).toThrow(/solo sul Supabase locale/)
  })

  it.each(['', 'non-un-url', '127.0.0.1:54321'])('rifiuta un URL che non si interpreta: «%s»', (url) => {
    expect(() => assertLocalSupabase(url, LOCAL_SERVICE_ROLE_KEY)).toThrow(/URL non valido/)
  })

  it.each([
    ['una chiave qualunque', 'una-chiave-vera-qualunque'],
    ['una chiave vuota', ''],
    ['la chiave anonima demo', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'],
  ])('rifiuta %s, anche con un URL locale', (_, key) => {
    expect(() => assertLocalSupabase('http://127.0.0.1:54321', key)).toThrow(/non è quella demo/)
  })
})
