import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Il testo tenue (`--muted-foreground`) regge 4,5:1 sulle superfici dove si
 * usa, nei due temi (#162).
 *
 * Nel tema chiaro stava a 4,35:1 sopra `bg-muted`, nei riquadri informativi
 * dei dialoghi di condivisione, e a 4,54:1 sopra `bg-muted/50` nell'account
 * delle Impostazioni. Nessun test poteva accorgersene: il contrasto si guardava
 * a occhio. Gemello, per principio, del test dei ruoli di entro-mobile (#175).
 *
 * La soglia è quella di WCAG 1.4.3 per il testo, segnaposto compreso: 4,5:1.
 * I valori si leggono da `src/index.css`, la fonte, e si convertono come fa il
 * browser: da HSL a RGB arrotondato a 8 bit.
 */

const CSS = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8')

type Rgb = [number, number, number]

/** Le variabili HSL (`H S% L%`) di un blocco di `index.css`, già in RGB. */
function variablesOf(opening: string): Record<string, Rgb> {
  const start = CSS.indexOf(opening)
  if (start === -1) throw new Error(`blocco non trovato in index.css: ${opening}`)
  const body = CSS.slice(start + opening.length)
  const values: Record<string, Rgb> = {}
  for (const row of body.slice(0, body.indexOf('}')).split('\n')) {
    const found = row.match(/^\s*--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;/)
    if (found) values[found[1]] = hslToRgb(Number(found[2]), Number(found[3]), Number(found[4]))
  }
  return values
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0), f(8), f(4)].map((c) => Math.round(c * 255)) as Rgb
}

/** `top` all'opacità `alpha` sopra `bottom`, come `bg-muted/50` sulla card. */
function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((c, i) => Math.round(c * alpha + bottom[i] * (1 - alpha))) as Rgb
}

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

const THEMES = [
  { name: 'chiaro', vars: variablesOf(':root {') },
  { name: 'scuro', vars: variablesOf('.dark {') },
]

describe('--muted-foreground regge 4,5:1', () => {
  for (const { name, vars } of THEMES) {
    const text = vars['muted-foreground']
    const surfaces: [string, Rgb][] = [
      ['--background', vars.background],
      ['--card', vars.card],
      ['--muted (i riquadri dei dialoghi di condivisione)', vars.muted],
      ['--muted al 50% sulla card (l\'account nelle Impostazioni)', over(vars.muted, 0.5, vars.card)],
    ]
    for (const [surface, color] of surfaces) {
      it(`tema ${name}, su ${surface}`, () => {
        expect(contrast(text, color)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
