import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Con «più contrasto» chiesto al sistema, il contorno dei campi (`--input`)
 * regge 3:1 sui fondi dove compare, nei due temi (#217).
 *
 * WCAG 1.4.11 chiede 3:1 al confine di un controllo quando è il confine a
 * farlo riconoscere. Di base il contorno sta a 1,26:1 in chiaro e 1,31:1 in
 * scuro, e resta così: lo rinforza solo `prefers-contrast: more`, come su iOS
 * nel nativo (entro-mobile#243). `--border`, che disegna card e separatori,
 * non cambia in nessuna condizione.
 *
 * I valori si leggono da `src/index.css` e si convertono come fa il browser,
 * allo stesso modo di `mutedForegroundContrast.test.ts`.
 */

const CSS = readFileSync(join(__dirname, '..', '..', 'index.css'), 'utf8')

const MORE_CONTRAST = '@media (prefers-contrast: more) {'

type Rgb = [number, number, number]
type Hsl = string

/** Il testo di un blocco `{ … }` a partire dalla sua apertura, graffe annidate comprese. */
function blockAfter(source: string, opening: string): string {
  const start = source.indexOf(opening)
  if (start === -1) throw new Error(`blocco non trovato in index.css: ${opening}`)
  let depth = 1
  let end = start + opening.length
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++
    if (source[end] === '}') depth--
    end++
  }
  return source.slice(start + opening.length, end - 1)
}

/** Le variabili HSL (`H S% L%`) dichiarate direttamente in un blocco. */
function variablesOf(source: string, opening: string): Record<string, Hsl> {
  const values: Record<string, Hsl> = {}
  for (const row of blockAfter(source, opening).split('\n')) {
    const found = row.match(/^\s*--([\w-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%);/)
    if (found) values[found[1]] = found[2]
  }
  return values
}

function toRgb(hsl: Hsl): Rgb {
  const [h, s, l] = hsl.split(/\s+/).map((part) => parseFloat(part))
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

const more = blockAfter(CSS, MORE_CONTRAST)

const THEMES = [
  { name: 'chiaro', base: variablesOf(CSS, ':root {'), reinforced: variablesOf(more, ':root {') },
  { name: 'scuro', base: variablesOf(CSS, '.dark {'), reinforced: variablesOf(more, '.dark {') },
]

describe('con prefers-contrast: more il contorno dei campi regge 3:1', () => {
  for (const { name, base, reinforced } of THEMES) {
    const outline = toRgb(reinforced.input)
    const muted = toRgb(base.muted)
    const card = toRgb(base.card)
    const surfaces: [string, Rgb][] = [
      ['--background (pagine e dialoghi)', toRgb(base.background)],
      ['--card (login, filtri)', card],
      ['--popover', toRgb(base.popover)],
      ['--muted e --accent (il pulsante con contorno sotto il puntatore)', muted],
      ['--muted al 50% sulla card (le sezioni chiuse del form)', over(muted, 0.5, card)],
    ]
    for (const [surface, color] of surfaces) {
      it(`tema ${name}, su ${surface}`, () => {
        expect(contrast(outline, color)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})

describe('senza la preferenza non cambia niente', () => {
  it('il contorno dei campi è quello di prima, nei due temi', () => {
    expect(THEMES.map((theme) => theme.base.input)).toEqual(['0 0% 89.8%', '0 0% 14.9%'])
  })

  it('la regola rinforzata viene dopo i valori di base, o non vincerebbe', () => {
    expect(CSS.indexOf(MORE_CONTRAST)).toBeGreaterThan(CSS.indexOf('.dark {'))
  })
})

describe('card, separatori, errore e fuoco non cambiano in nessuna condizione', () => {
  it('--border è quello di prima', () => {
    expect(THEMES.map((theme) => theme.base.border)).toEqual(['0 0% 89.8%', '0 0% 14.9%'])
  })

  for (const { name, reinforced } of THEMES) {
    it(`tema ${name}: la regola rinforzata tocca solo --input`, () => {
      expect(Object.keys(reinforced)).toEqual(['input'])
    })
  }
})
