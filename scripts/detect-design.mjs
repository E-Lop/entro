#!/usr/bin/env node
/**
 * Design linter wrapper (pubblico).
 *
 * Delega al detector deterministico di Impeccable, che vive in `.claude/skills/`
 * ed è gitignored (locale, non versionato). Su un clone pulito la skill può
 * mancare: in quel caso questo wrapper degrada con un messaggio invece di
 * rompere `npm run detect:design`.
 *
 * Uso: node scripts/detect-design.mjs [target]   (default: src)
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const DETECTOR = '.claude/skills/impeccable/scripts/detect.mjs'

if (!existsSync(DETECTOR)) {
  console.log(
    '[detect:design] Impeccable non installato — design linter saltato.\n' +
    '  Per abilitarlo: npx impeccable skills install'
  )
  process.exit(0)
}

const target = process.argv[2] ?? 'src'
const result = spawnSync('node', [DETECTOR, '--json', target], { stdio: 'inherit' })
// Propaga l'exit code del detector (≠0 quando trova findings).
process.exit(result.status ?? 0)
