import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'playwright-report', 'test-results'] },
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
