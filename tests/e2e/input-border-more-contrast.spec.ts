import { expect, test, type Page } from '@playwright/test'

/**
 * Con «più contrasto» chiesto al sistema il contorno dei campi arriva a 3:1, e
 * per gli altri resta com'era (#217).
 *
 * `inputBorderContrast.test.ts` tiene i numeri dei token; qui si guarda che
 * la regola arrivi davvero al campo, nel browser, nei due temi: il tema segue
 * `prefers-color-scheme`, e la regola deve vincere su tutti e due.
 */

type Rgb = [number, number, number]

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const parse = (color: string) => color.match(/\d+/g)!.slice(0, 3).map(Number) as Rgb

/** Il contorno del campo Email e il fondo della card che lo contiene. */
async function emailOutline(page: Page): Promise<{ outline: Rgb; ground: Rgb }> {
  const email = page.getByLabel('Email')
  await expect(email).toBeVisible()
  const outline = await email.evaluate((el) => getComputedStyle(el).borderTopColor)
  const ground = await email.evaluate((el) => getComputedStyle(el.closest('.bg-card')!).backgroundColor)
  return { outline: parse(outline), ground: parse(ground) }
}

const TODAY: Record<'light' | 'dark', Rgb> = { light: [229, 229, 229], dark: [38, 38, 38] }

for (const colorScheme of ['light', 'dark'] as const) {
  test(`tema ${colorScheme}: con più contrasto il contorno del campo regge 3:1`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, contrast: 'more' })
    await page.goto('/login')

    const { outline, ground } = await emailOutline(page)

    expect(contrast(outline, ground)).toBeGreaterThanOrEqual(3)
  })

  test(`tema ${colorScheme}: senza la preferenza il contorno è quello di prima`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, contrast: 'no-preference' })
    await page.goto('/login')

    const { outline } = await emailOutline(page)

    expect(outline).toEqual(TODAY[colorScheme])
  })
}
