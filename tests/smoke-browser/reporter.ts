/**
 * Il reporter della suite di smoke nel browser: nome del test ed esito, e
 * nient'altro (#191). È il gemello di quello della suite API
 * (`tests/smoke/reporter.ts`), per Playwright.
 *
 * La suite gira anche contro entroapp.it, e i log di Actions di questo repo
 * sono pubblici. Un errore di Playwright porta con sé il testo della pagina:
 * il «received» di un `expect`, il call log con l'elemento trovato, il nome di
 * un alimento. Qui di un fallimento si stampa solo la categoria di una
 * `SmokeFailure`, che è testo scritto nel codice; qualunque altro errore
 * diventa «errore non classificato». La console dei test non si stampa.
 */
import type { FullResult, Reporter, TestCase, TestError, TestResult } from '@playwright/test/reporter'

const SMOKE_FAILURE = 'SmokeFailure'

/**
 * La categoria di un errore, o «errore non classificato».
 *
 * Playwright serializza l'errore del worker senza il suo `name`: una
 * `SmokeFailure` si riconosce dalla prima riga dello stack, che è
 * `SmokeFailure: <categoria>`.
 */
export function category(error: Pick<TestError, 'message' | 'stack'> | undefined): string {
  const prefix = `${SMOKE_FAILURE}: `
  if (!error?.stack?.startsWith(prefix) || !error.message) return 'errore non classificato'
  return error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message
}

export default class SmokeBrowserReporter implements Reporter {
  private lines: string[] = []
  private failed = 0
  private passed = 0

  /** Stampa da sé: Playwright non aggiunge altro output. */
  printsToStdio(): boolean {
    return true
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const title = test.titlePath().filter(Boolean).slice(1).join(' › ')
    if (result.status === 'passed') {
      this.passed++
      this.lines.push(`✓ ${title}`)
    } else if (result.status === 'skipped') {
      this.lines.push(`- ${title} (non eseguito)`)
    } else {
      this.failed++
      this.lines.push(`✗ ${title} — ${category(result.errors[0])}`)
    }
  }

  onError(error: TestError): void {
    this.failed++
    this.lines.push(`✗ errore fuori dai test — ${category(error)}`)
  }

  onEnd(result: FullResult): void {
    this.lines.push(`${this.passed} passati, ${this.failed} falliti (${result.status})`)
    process.stdout.write(`${this.lines.join('\n')}\n`)
  }
}
