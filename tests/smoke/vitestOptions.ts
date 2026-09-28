/**
 * Le opzioni di vitest della suite di smoke, condivise dalla sua config e dalla
 * fixture che prova il reporter (#187): la fixture deve girare con lo stesso
 * reporter e lo stesso silenzio, o non proverebbe niente.
 */
import { BaseSequencer, type TestSpecification } from 'vitest/node'
import type { ViteUserConfig } from 'vitest/config'
import { SmokeReporter } from './reporter'

/** I file nell'ordine del loro nome: a, poi b, poi c. */
class ByNameSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return [...files].sort((left, right) => left.moduleId.localeCompare(right.moduleId))
  }
}

export function smokeTestOptions(include: string[]): NonNullable<ViteUserConfig['test']> {
  return {
    include,
    environment: 'node',
    fileParallelism: false,
    sequence: { sequencer: ByNameSequencer },
    // Niente console dei test: potrebbe contenere risposte del server.
    silent: true,
    reporters: [new SmokeReporter()],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  }
}
