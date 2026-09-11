/**
 * Lo schema di validazione **gemello**, quello che gira sul client nativo.
 *
 * `src/lib/validations/food.schemas.ts` non è un pacchetto condiviso: è una
 * **copia**. L'altra è `src/shared/validations/food.schemas.ts` su entro-mobile,
 * e le due possono divergere senza che niente diventi rosso — è la #120, e il
 * difetto l'ha già prodotto una volta (`min(0)` contro `min(0.01)`, registrato
 * in `log.md:32` del bundle).
 *
 * Il guardiano esisteva **da un lato solo**: entro-mobile confronta i due
 * schemi da settembre, quindi una modifica fatta lì diventa rossa lì. Una
 * modifica fatta **qui** però non diventava rossa da nessuna parte finché
 * qualcuno non spingeva sull'altro repo, che può essere giorni dopo. Questo
 * file è il lato che mancava.
 *
 * Vale la stessa regola di `familyBundle.ts`: l'assenza è un **errore**, non un
 * motivo per saltare. Un guardiano che diventa verde quando non trova la
 * sorgente passa esattamente nella situazione in cui non sta guardando niente.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * In locale vale la convenzione dei repo affiancati in `~/Documents/`
 * (CLAUDE.md). In CI quel percorso non esiste: il workflow clona entro-mobile
 * e punta qui con `ENTRO_MOBILE_SCHEMAS_DIR`, come già fa `ENTRO_FAMILY_DIR`
 * per il bundle.
 *
 * ⚠️ A differenza del bundle, entro-mobile è **privato**: quel checkout ha
 * bisogno di `ENTRO_MOBILE_TOKEN`. Il verso opposto è gratis perché entro è
 * pubblico, ed è il motivo per cui il guardiano è nato di là.
 */
const SCHEMAS_FOLDER = process.env.ENTRO_MOBILE_SCHEMAS_DIR
  ? resolve(process.env.ENTRO_MOBILE_SCHEMAS_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-mobile', 'src', 'shared', 'validations')

/**
 * La forma che questo helper pretende dal modulo gemello. Volutamente minima:
 * qui interessa solo poter far girare lo schema su un payload.
 */
interface ComparableSchema {
  safeParse(value: unknown): {
    success: boolean
    error?: { issues: readonly { path: readonly PropertyKey[] }[] }
  }
}

/**
 * Il `foodFormSchema` di entro-mobile.
 *
 * È `async` perché il gemello è un `.ts` fuori dalla radice di questo progetto:
 * si carica con un `import()` dinamico, che vitest trasforma come un modulo
 * qualsiasi. Il `require()` usato dall'helper speculare su entro-mobile qui non
 * si porta — là è jest, qui è vitest, e il meccanismo è l'unica cosa che i due
 * lati non hanno in comune.
 *
 * I due schemi girano sulla **stessa** copia di zod: l'alias in
 * `vitest.config.ts` risolve `zod` sempre su quello di questo repo. Non è un
 * dettaglio di comodo — senza, il confronto misurerebbe anche lo scarto fra le
 * due versioni installate (4.3.5 qui, 4.4.3 su entro-mobile all'11 set 2026)
 * invece delle due dichiarazioni, che sono l'unica cosa che questo test
 * sorveglia. E fallirebbe nel modo peggiore possibile: `expected [Function
 * ZodObject] to be [Function ZodObject] — Compared values have no visual
 * difference`.
 */
export async function twinFormSchema(): Promise<ComparableSchema> {
  const path = join(SCHEMAS_FOLDER, 'food.schemas.ts')

  if (!existsSync(path)) {
    throw new Error(
      `Schema gemello non trovato in ${path}. Lo schema di validazione è ` +
        'duplicato fra i due client e questo test li confronta: clona ' +
        '`E-Lop/entro-mobile` affiancato a questo repo (CLAUDE.md), oppure ' +
        'indica la cartella con ENTRO_MOBILE_SCHEMAS_DIR.'
    )
  }

  // Percorso noto solo a runtime: un `import` statico non lo esprime, e
  // `@vite-ignore` dice a vite di non provare ad analizzarlo a build time.
  const module = (await import(/* @vite-ignore */ pathToFileURL(path).href)) as {
    foodFormSchema?: ComparableSchema
  }

  if (!module.foodFormSchema) {
    throw new Error(
      `${path} non esporta più \`foodFormSchema\`. Se lo schema di entro-mobile ` +
        'è stato rinominato, questo helper va aggiornato: il confronto fra i due ' +
        'client non deve sparire in silenzio.'
    )
  }

  return module.foodFormSchema
}
