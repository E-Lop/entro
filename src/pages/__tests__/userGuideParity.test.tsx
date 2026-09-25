// @vitest-environment jsdom
/**
 * Il guardiano delle due guide (#148).
 *
 * La guida utente esiste due volte, e di proposito: `GuidePage.tsx` è quella
 * che si legge nell'app, su /guida; `docs/guides/USER_GUIDE.md` è quella che
 * legge chi arriva su GitHub senza installare niente, e il README la presenta
 * come «Guida utente completa». Rendere la prima dal markdown è stato scartato
 * (decisione del 22 set 2026). Due copie scritte a mano però divergono: dal 2
 * luglio al 21 settembre nessuna delle due è stata toccata, e la markdown era
 * indietro anche rispetto all'altra.
 *
 * Il test confronta la **struttura**: i titoli h2/h3 della guida in app resa
 * in jsdom con i `##`/`###` della markdown, nello stesso ordine, e le domande
 * della sezione «Domande frequenti».
 *
 * ⚠️ **Il limite, accettato dal maintainer:** confronta i titoli, non il
 * contenuto. Due sezioni con lo stesso titolo e testi diversi passano. Se
 * un comportamento cambia e si aggiorna il testo di una guida sola, questo
 * test resta verde. Chi cambia una sezione cambia l'altra a mano.
 *
 * Non guarda nemmeno la guida rapida (`QuickGuideDialog.tsx`): non ha titoli
 * di sezione, è un riassunto.
 *
 * Come gli altri guardiani del repo, se `USER_GUIDE.md` manca il test
 * **fallisce**: uno che si salta quando non trova la sorgente passa proprio
 * quando non sta guardando niente.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GuidePage } from '../GuidePage'

const USER_GUIDE = join(__dirname, '..', '..', '..', 'docs', 'guides', 'USER_GUIDE.md')

const FAQ_TITLE = 'Domande frequenti'

interface Heading {
  level: 2 | 3
  text: string
}

/**
 * Le sezioni che esistono di proposito in una guida sola. Ciascuna esclude il
 * suo h2 **e** gli h3 che contiene, e porta il suo perché: un'eccezione senza
 * motivo è una divergenza con un permesso.
 */
const MARKDOWN_ONLY: ReadonlyArray<{ title: string; reason: string }> = [
  {
    title: 'Indice',
    reason: 'è la navigazione del file su GitHub; nell’app la pagina si scorre',
  },
  {
    title: 'Primi passi',
    reason:
      'registrazione, accesso e password dimenticata: chi apre /guida ha già fatto l’accesso, ' +
      'chi legge su GitHub no',
  },
  {
    title: 'Supporto',
    reason: 'nell’app i contatti stanno in Impostazioni, nella card «Supporto»',
  },
]

const APP_ONLY: ReadonlyArray<{ title: string; reason: string }> = []

afterEach(cleanup)

function appHeadings(): Heading[] {
  const { container } = render(
    <MemoryRouter>
      <GuidePage />
    </MemoryRouter>
  )
  return Array.from(container.querySelectorAll('h2, h3')).map((element) => ({
    level: element.tagName === 'H2' ? 2 : 3,
    text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }))
}

function markdownHeadings(): Heading[] {
  const source = readFileSync(USER_GUIDE, 'utf8')
  const headings: Heading[] = []
  let inFence = false
  for (const line of source.split('\n')) {
    // Un `## ` dentro un blocco di codice non è un titolo.
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) {
      headings.push({ level: match[1].length === 2 ? 2 : 3, text: match[2].trim() })
    }
  }
  return headings
}

/** Toglie le sezioni dichiarate, con i loro h3. */
function withoutExceptions(headings: Heading[], exceptions: ReadonlyArray<{ title: string }>): Heading[] {
  const skipped = new Set(exceptions.map((exception) => exception.title))
  const kept: Heading[] = []
  let skipping = false
  for (const heading of headings) {
    if (heading.level === 2) skipping = skipped.has(heading.text)
    if (!skipping) kept.push(heading)
  }
  return kept
}

function faqQuestions(headings: Heading[]): string[] {
  const start = headings.findIndex((heading) => heading.level === 2 && heading.text === FAQ_TITLE)
  if (start === -1) return []
  const questions: string[] = []
  for (const heading of headings.slice(start + 1)) {
    if (heading.level === 2) break
    questions.push(heading.text)
  }
  return questions
}

const asLine = (heading: Heading) => `${'#'.repeat(heading.level)} ${heading.text}`

describe('le due guide hanno la stessa struttura', () => {
  it('USER_GUIDE.md esiste', () => {
    expect(
      existsSync(USER_GUIDE),
      `Guida markdown non trovata in ${USER_GUIDE}: è la guida di GitHub, non si toglie (#148).`
    ).toBe(true)
  })

  // Senza, due scansioni vuote risulterebbero uguali: la forma peggiore di verde.
  it('la scansione trova i titoli in tutte e due', () => {
    const app = appHeadings()
    const markdown = markdownHeadings()
    expect(app.filter((heading) => heading.level === 2).length).toBeGreaterThanOrEqual(10)
    expect(app.filter((heading) => heading.level === 3).length).toBeGreaterThanOrEqual(20)
    expect(markdown.filter((heading) => heading.level === 2).length).toBeGreaterThanOrEqual(10)
    expect(markdown.filter((heading) => heading.level === 3).length).toBeGreaterThanOrEqual(20)
  })

  it('le eccezioni dichiarate esistono davvero, dalla parte che dicono', () => {
    const appTitles = appHeadings().filter((h) => h.level === 2).map((h) => h.text)
    const markdownTitles = markdownHeadings().filter((h) => h.level === 2).map((h) => h.text)
    // Un'eccezione rimasta dopo che la sezione è sparita, o arrivata anche
    // nell'altra guida, non esclude più niente: va tolta.
    for (const { title } of MARKDOWN_ONLY) {
      expect(markdownTitles, `«${title}» è dichiarata solo nella markdown`).toContain(title)
      expect(appTitles, `«${title}» è dichiarata solo nella markdown`).not.toContain(title)
    }
    for (const { title } of APP_ONLY) {
      expect(appTitles, `«${title}» è dichiarata solo nell'app`).toContain(title)
      expect(markdownTitles, `«${title}» è dichiarata solo nell'app`).not.toContain(title)
    }
  })

  it('nessun titolo sta in una guida sola, fuori dalle eccezioni', () => {
    const app = withoutExceptions(appHeadings(), APP_ONLY).map(asLine)
    const markdown = withoutExceptions(markdownHeadings(), MARKDOWN_ONLY).map(asLine)

    // Prima cosa manca, poi l'ordine: un elenco delle differenze si legge
    // meglio di due array lunghi quaranta righe.
    expect({
      onlyInApp: app.filter((line) => !markdown.includes(line)),
      onlyInMarkdown: markdown.filter((line) => !app.includes(line)),
    }).toEqual({ onlyInApp: [], onlyInMarkdown: [] })
  })

  it('i titoli sono nello stesso ordine', () => {
    const app = withoutExceptions(appHeadings(), APP_ONLY).map(asLine)
    const markdown = withoutExceptions(markdownHeadings(), MARKDOWN_ONLY).map(asLine)
    expect(markdown).toEqual(app)
  })

  it('le domande frequenti sono le stesse, nello stesso ordine', () => {
    const app = faqQuestions(appHeadings())
    const markdown = faqQuestions(markdownHeadings())

    expect(app.length, `nessuna domanda sotto «${FAQ_TITLE}» nella guida in app`).toBeGreaterThan(0)
    expect(markdown.length, `nessuna domanda sotto «${FAQ_TITLE}» in USER_GUIDE.md`).toBeGreaterThan(0)
    for (const question of [...app, ...markdown]) {
      expect(question, 'sotto le domande frequenti ci vanno domande').toMatch(/\?$/)
    }
    expect(markdown).toEqual(app)
  })
})
