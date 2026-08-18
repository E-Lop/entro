import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // `supabase/.temp/` è già in `.gitignore`, ma non basta: il flat config di
  // ESLint **non** legge `.gitignore`, quindi va ripetuto qui. Dentro c'è il
  // runtime generato dallo stack Supabase locale — un bundle minificato che a
  // stack acceso produce ~190 errori e sommerge quelli veri.
  { ignores: ['dist', 'playwright-report', 'test-results', 'supabase/.temp'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // I componenti di `src/components/ui/` sono **vendorizzati**: li genera la CLI
  // di shadcn e li riscrive `shadcn add` a ogni aggiornamento. Che `button.tsx`
  // esporti `buttonVariants` accanto a `Button`, e `form.tsx` esporti
  // `useFormField`, è la loro convenzione, non una nostra scelta: spostare
  // quegli export li farebbe divergere dall'upstream e il primo aggiornamento
  // li rimetterebbe com'erano. Qui la regola di Fast Refresh si spegne; per i
  // componenti nostri resta accesa, ed è stata rispettata spostando il codice.
  {
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // Niente segreti in console (issue #79, #84).
  //
  // `console.error('contesto:', error)` stampa anche le *proprietà*
  // dell'errore, ed è lì che i client Supabase attaccano i dati della
  // risposta — la sessione compresa. Nessuna riga lo fa di proposito: i
  // segreti escono di rimbalzo, ed è il motivo per cui rileggere il codice a
  // occhio non li aveva visti.
  //
  // L'ambito è tutto `src/`, non solo `lib` e `stores`: i punti più a rischio
  // — `useSignedUrl.ts`, `DeleteAccountDialog.tsx` — stanno fuori da entrambe
  // quelle cartelle, e un ambito che esclude i punti pericolosi è peggio di
  // nessun ambito, perché sembra copertura.
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.name='console'][callee.property.name=/^(error|warn|log|info|debug)$/][arguments.length>1]",
        message: 'Passare un secondo argomento a console.* ne stampa le proprietà, dove i client Supabase mettono i dati della risposta. Usa logError/logWarn da @/lib/safeLog.',
      }],
    },
  },
  {
    files: ['playwright.config.ts', 'tests/e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
)
