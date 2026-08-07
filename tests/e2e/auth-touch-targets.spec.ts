import { expect, test } from '@playwright/test'

// I link di navigazione delle schermate auth erano `<a>` nudi alti quanto la
// loro riga di testo (~20px a `text-sm`): sotto i 24×24 px CSS richiesti da
// WCAG 2.2 SC 2.5.8 (AA). La soglia usata qui è 44, allineata alle 44pt iOS /
// 48dp Android della app nativa: vedi la convenzione condivisa
// `entro-family/conventions/touch-target-e-semantica-link.md`.
//
// I link *inline in una frase* ("Non hai un account? **Registrati**") sono
// esclusi di proposito: SC 2.5.8 li esenta esplicitamente, e allargarli
// spezzerebbe il flusso del testo. Qui si verificano solo quelli isolati.
const ALTEZZA_MINIMA = 44

test.use({ viewport: { width: 390, height: 844 } })

const CASI = [
  { pagina: '/login', link: 'Password dimenticata?' },
  { pagina: '/forgot-password', link: 'Torna al login' },
  { pagina: '/verify-email?email=e2e%40example.com', link: 'Torna al login' },
] as const

test.describe('bersagli tattili dei link auth (mobile)', () => {
  for (const { pagina, link } of CASI) {
    test(`"${link}" su ${pagina} è alto almeno ${ALTEZZA_MINIMA}px`, async ({ page }) => {
      await page.goto(pagina)

      const target = page.getByRole('link', { name: link })
      await expect(target).toBeVisible()

      const box = await target.boundingBox()
      expect(box, `Nessun box per il link "${link}"`).not.toBeNull()
      expect(
        box!.height,
        `Il link "${link}" su ${pagina} è alto ${box!.height}px`,
      ).toBeGreaterThanOrEqual(ALTEZZA_MINIMA)
    })
  }
})
