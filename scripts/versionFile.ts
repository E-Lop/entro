/**
 * `/version.json`: lo SHA del commit che la build ha compilato (#190).
 *
 * Netlify non manda a GitHub un evento di deploy di produzione. Il workflow
 * che a ogni push su `main` lancia la suite di smoke interroga questo file sul
 * sito finché lo SHA non è quello del push (`scripts/smoke/wait-for-deploy.mjs`).
 * Il dev server lo serve con lo stesso contenuto, e `vite preview` lo trova in
 * `dist/` come ogni altro file.
 */
import { execFileSync } from 'node:child_process'
import type { Plugin } from 'vite'

export const VERSION_FILE = 'version.json'

function gitHead(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
}

/**
 * Lo SHA del commit: `COMMIT_REF` su Netlify, `GITHUB_SHA` in Actions, git in
 * locale. Senza nessuno dei tre, «unknown»: non coincide con nessuno SHA, e
 * l'attesa del deploy fallisce dicendolo invece di passare per caso.
 */
export function resolveCommitSha(env: Record<string, string | undefined> = process.env, git: () => string = gitHead): string {
  if (env.COMMIT_REF) return env.COMMIT_REF
  if (env.GITHUB_SHA) return env.GITHUB_SHA
  try {
    return git() || 'unknown'
  } catch {
    return 'unknown'
  }
}

export function versionFile(sha: string = resolveCommitSha()): Plugin {
  const source = `${JSON.stringify({ sha })}\n`
  return {
    name: 'entro-version-file',
    configureServer(server) {
      server.middlewares.use(`/${VERSION_FILE}`, (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-store')
        res.end(source)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: VERSION_FILE, source })
    },
  }
}
