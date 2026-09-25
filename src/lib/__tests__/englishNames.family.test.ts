/**
 * Il guardiano della lingua dei nomi.
 *
 * Il 9 settembre 2026 questa repo aveva lo 0,4% delle dichiarazioni di
 * produzione in italiano contro il 22,6% di entro-mobile — ma quasi tutte
 * venivano dal commit del giorno prima. Non era immunità, era ritardo, e la
 * regola non era nemmeno scritta qui dentro. Da qui in poi la tiene un test.
 *
 * La convenzione e la lista di parole stanno nel bundle di famiglia, in
 * `conventions/code-in-english.md`: la regola è la stessa per i due client, e
 * due copie divergerebbero.
 *
 * **Non** guarda i commenti né il testo mostrato all'utente: quelli sono prosa,
 * e restano in italiano.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { bundleConvention } from './familyBundle'

const ROOT = join(__dirname, '..', '..', '..')

/**
 * Valori che *sembrano* nomi ma vengono dal database: `confezioni` è un membro
 * del vocabolario di `quantity_unit`, garantito da un `CHECK`. Rinominarlo è
 * una migrazione sullo schema condiviso, non una scelta di stile.
 */
const FROM_THE_DATABASE = new Set(['confezioni'])

const ITALIAN = new Set(
  bundleConvention('italian-words.txt')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
)

/** `quantitaInItaliano` → `quantita`, `in`, `italiano`. */
function words(name: string): string[] {
  return name
    .replace(/[_$-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function italianWords(name: string): string[] {
  if (FROM_THE_DATABASE.has(name)) return []
  return words(name).filter((w) => ITALIAN.has(w))
}

function tracked(...globs: string[]): string[] {
  return execFileSync('git', ['ls-files', ...globs], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

const SOURCES = tracked('*.ts', '*.tsx', '*.js', '*.mjs')

/** I nomi che il progetto **dichiara**, con dove stanno. */
function declarations(): { name: string; where: string }[] {
  const found: { name: string; where: string }[] = []
  for (const file of SOURCES) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    const sf = ts.createSourceFile(
      file,
      src,
      ts.ScriptTarget.Latest,
      true,
      /\.(tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX : undefined
    )
    const nameOf = (n: ts.Node | undefined): string | null =>
      n && (ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || ts.isStringLiteral(n)) ? n.text : null

    const walk = (n: ts.Node): void => {
      let target: ts.Node | undefined
      if (
        ts.isVariableDeclaration(n) ||
        ts.isFunctionDeclaration(n) ||
        ts.isParameter(n) ||
        ts.isPropertySignature(n) ||
        ts.isPropertyDeclaration(n) ||
        ts.isPropertyAssignment(n) ||
        ts.isShorthandPropertyAssignment(n) ||
        ts.isMethodDeclaration(n) ||
        ts.isMethodSignature(n) ||
        ts.isInterfaceDeclaration(n) ||
        ts.isTypeAliasDeclaration(n) ||
        ts.isClassDeclaration(n) ||
        ts.isEnumDeclaration(n) ||
        ts.isEnumMember(n) ||
        ts.isTypeParameterDeclaration(n)
      ) {
        target = n.name
      } else if (ts.isBindingElement(n)) {
        target = n.propertyName ?? n.name
      }
      const name = nameOf(target)
      if (name) {
        const line = sf.getLineAndCharacterOfPosition(target!.getStart(sf)).line + 1
        found.push({ name, where: `${file}:${line}` })
      }
      ts.forEachChild(n, walk)
    }
    ts.forEachChild(sf, walk)
  }
  return found
}

/** I `data-testid`: sono selettori, cioè superficie di sviluppo, non copy. */
function testIds(): { name: string; where: string }[] {
  const found: { name: string; where: string }[] = []
  for (const file of SOURCES) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/data-testid=["']([^"']+)["']/g)) {
        found.push({ name: m[1], where: `${file}:${i + 1}` })
      }
    })
  }
  return found
}

/** Il messaggio che si legge quando fallisce: il nome, dove sta, e la parola colpevole. */
function offenders(items: { name: string; where: string }[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const { name, where } of items) {
    const italian = italianWords(name)
    if (!italian.length || seen.has(name)) continue
    seen.add(name)
    out.push(`${where} → «${name}» (${italian.join(', ')})`)
  }
  return out.sort()
}

describe('i nomi sono in inglese', () => {
  /**
   * Senza, il test passerebbe su una lista svuotata o su un estrattore che non
   * aggancia più niente — la forma peggiore di verde.
   */
  it('il guardiano sta guardando qualcosa', () => {
    expect(ITALIAN.size).toBeGreaterThan(1000)
    expect(declarations().length).toBeGreaterThan(1000)
    expect(SOURCES.length).toBeGreaterThan(100)
  })

  it('nessuna dichiarazione porta una parola italiana', () => {
    expect(offenders(declarations())).toEqual([])
  })

  it('nessun nome di file porta una parola italiana', () => {
    const files = tracked().map((f) => ({
      name: basename(f).replace(/\.[^.]+$/, ''),
      where: f,
    }))
    expect(offenders(files)).toEqual([])
  })

  it('nessun data-testid porta una parola italiana', () => {
    expect(offenders(testIds())).toEqual([])
  })
})
