/**
 * Il reporter della suite di smoke: nome del test ed esito, e nient'altro
 * (#187).
 *
 * Di un fallimento stampa la categoria se l'errore è una `SmokeFailure`, il cui
 * messaggio è testo scritto nel codice. Qualunque altro errore — un `expect`
 * con il suo diff, un'eccezione di supabase-js, una promise rifiutata — diventa
 * «errore non classificato», senza messaggio. Non stampa la console dei test.
 */
import { basename } from 'node:path'
import type { Reporter, TestCase, TestModule } from 'vitest/node'

interface ReportedError {
  name?: string
  message?: string
}

function category(error: ReportedError | undefined): string {
  return error?.name === 'SmokeFailure' && error.message ? error.message : 'errore non classificato'
}

export class SmokeReporter implements Reporter {
  private lines: string[] = []
  private failed = 0
  private passed = 0

  onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result()
    if (result.state === 'passed') {
      this.passed++
      this.lines.push(`✓ ${testCase.fullName}`)
    } else if (result.state === 'failed') {
      this.failed++
      this.lines.push(`✗ ${testCase.fullName} — ${category(result.errors?.[0])}`)
    } else {
      this.lines.push(`- ${testCase.fullName} (non eseguito)`)
    }
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<ReportedError>
  ): void {
    for (const testModule of testModules) {
      const file = basename(testModule.moduleId)
      for (const error of testModule.errors()) {
        this.failed++
        this.lines.push(`✗ ${file} — ${category(error)}`)
      }
      for (const describeBlock of testModule.children.allSuites()) {
        for (const error of describeBlock.errors()) {
          this.failed++
          this.lines.push(`✗ ${describeBlock.fullName} — ${category(error)}`)
        }
      }
    }
    for (const error of unhandledErrors) {
      this.failed++
      this.lines.push(`✗ errore fuori dai test — ${category(error)}`)
    }

    this.lines.push(`${this.passed} passati, ${this.failed} falliti`)
    process.stdout.write(`${this.lines.join('\n')}\n`)
  }
}
