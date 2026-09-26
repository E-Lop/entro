/**
 * La scala delle distanze non deriva (#106).
 *
 * Il 25 set 2026 le distanze fra elementi erano dodici valori diversi in 43
 * file, e nessuno diceva **perché** fosse quel numero: il prossimo copiava dal
 * vicino. I gradini hanno un nome in `tailwind.config.js`, ma un nome che
 * chiunque può aggirare scrivendo `gap-3` è una convenzione, non una regola.
 *
 * Guarda `gap-*` e `space-y-*` / `space-x-*`: sul web `space-y` era più di un
 * terzo delle occorrenze, e lasciarla fuori avrebbe lasciato fuori metà del
 * layout. Non guarda i padding di inset (`px-4`), che sono distanza dal bordo e
 * non ritmo fra elementi.
 *
 * Gemello di `entro-mobile/__tests__/spacingScale.test.ts`; la convenzione è
 * `entro-family/conventions/distance-scale.md`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..')
const SRC = join(ROOT, 'src')

/** `gap-3`, `gap-x-2`, `space-y-1.5`, `-space-x-2`: la distanza scritta come numero. */
const NUMERIC_DISTANCE = /\b(?:gap(?:-[xy])?|space-[xy])-\d/g

/** Tutti i file di `src` tranne i test, che possono citare un valore per provarlo. */
function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sources(path)
    return /\.(tsx?|jsx?)$/.test(entry) && !/\.test\./.test(entry) ? [path] : []
  })
}

/** Le violazioni in un testo, come `file:riga → classe`. I commenti `//` non contano. */
function offendersIn(file: string, text: string): string[] {
  return text.split('\n').flatMap((row, index) =>
    (row.replace(/\/\/.*$/, '').match(NUMERIC_DISTANCE) ?? []).map(
      (found) => `${file}:${index + 1} → ${found}`,
    ),
  )
}

const files = sources(SRC)

describe('scala delle distanze', () => {
  it('trova i sorgenti da controllare', () => {
    // Se la scansione tornasse vuota il test passerebbe sempre: una regola che
    // non guarda niente.
    expect(files.length).toBeGreaterThan(50)
  })

  it('riconosce una distanza numerica, e ignora i commenti e i padding', () => {
    // Senza, una regex rotta lascerebbe verde il test sotto.
    expect(offendersIn('probe.tsx', '<div className="flex gap-3 space-y-1.5 gap-x-2">')).toEqual([
      'probe.tsx:1 → gap-3',
      'probe.tsx:1 → space-y-1',
      'probe.tsx:1 → gap-x-2',
    ])
    expect(offendersIn('probe.tsx', '<div className="gap-blocks px-4 py-2"> // era gap-4')).toEqual([])
  })

  it('nessuna distanza fra elementi scritta come numero: i gradini hanno un nome', () => {
    const offenders = files.flatMap((path) =>
      offendersIn(relative(ROOT, path), readFileSync(path, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('i gradini dichiarati sono i cinque del bundle, e sono tutti usati', () => {
    const config = readFileSync(join(ROOT, 'tailwind.config.js'), 'utf8')
    const start = config.indexOf('const DISTANCE_SCALE = {')
    if (start === -1) throw new Error('DISTANCE_SCALE non trovata in tailwind.config.js')
    const body = config.slice(start, config.indexOf('};', start))
    const declared = [...body.matchAll(/^\s{2}(\w+): '[\d.]+rem',$/gm)].map((m) => m[1])

    expect(declared.sort()).toEqual(['blocks', 'inner', 'paired', 'sections', 'siblings'])

    // Un gradino che nessuno usa invita a inventarne un altro.
    const text = files.map((p) => readFileSync(p, 'utf8')).join('\n')
    for (const step of declared) {
      expect(text, `il gradino «${step}» non è usato`).toMatch(
        new RegExp(`\\b(?:gap(?:-[xy])?|space-[xy])-${step}\\b`),
      )
    }
  })
})
