import { expect, test, type Browser, type Page } from '@playwright/test'
import { createE2EEmail, createE2EUser, deleteE2EUserByEmail } from './helpers/supabase'

// «Esci dagli altri dispositivi» (#143), con due sessioni vere dello stesso
// utente: due contesti del browser, cioè due dispositivi.
//
// Il server revoca i refresh token delle altre sessioni (Supabase, *Signing
// out*: le altre sessioni falliscono «the next time they try to refresh»).
// Si prova quindi il rinnovo della sessione di ciascun dispositivo con il suo
// refresh token, direttamente contro l'API di Auth: il secondo dev'essere
// rifiutato, il primo no.

const password = 'E2ePassword!2026'
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey = process.env.E2E_SUPABASE_ANON_KEY!

async function signedInDevice(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('heading', { name: /Ciao, / })).toBeVisible()
  return page
}

/** Il refresh token che questo dispositivo ha in `localStorage`. */
async function refreshTokenOf(page: Page): Promise<string> {
  return page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
    return JSON.parse(localStorage.getItem(key!)!).refresh_token as string
  })
}

async function canRefresh(refreshToken: string): Promise<boolean> {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return response.ok
}

test('dal primo dispositivo si chiude il secondo, e il primo resta dentro', async ({ browser }) => {
  const email = createE2EEmail()
  await createE2EUser(email, password)
  try {
    const first = await signedInDevice(browser, email)
    const second = await signedInDevice(browser, email)
    const secondToken = await refreshTokenOf(second)

    await first.goto('/settings')
    await first.getByRole('button', { name: 'Esci dagli altri dispositivi' }).click()
    await expect(first.getByText('Accesso chiuso sugli altri dispositivi')).toBeVisible()

    expect(await canRefresh(secondToken), 'il secondo dispositivo rinnova ancora la sessione').toBe(false)
    expect(await canRefresh(await refreshTokenOf(first)), 'il primo dispositivo è stato chiuso').toBe(true)
  } finally {
    await deleteE2EUserByEmail(email)
  }
})
