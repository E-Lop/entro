/**
 * Il file di versione del sito (#190): `/version.json`, con lo SHA del commit
 * che la build ha compilato.
 *
 * Netlify non manda a GitHub un evento di deploy di produzione, quindi il
 * workflow dopo il push interroga questo file finché lo SHA non è quello del
 * push. Il file deve uscire dalla build ed essere servito anche dal dev server,
 * con lo stesso contenuto.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { build, createServer, type ViteDevServer } from 'vite'
import { resolveCommitSha, VERSION_FILE, versionFile } from '../scripts/versionFile'

const SHA = '0123456789abcdef0123456789abcdef01234567'

describe('resolveCommitSha', () => {
  const git = () => 'fedcba9876543210fedcba9876543210fedcba98'

  it('su Netlify vince COMMIT_REF, il commit che Netlify sta compilando', () => {
    expect(resolveCommitSha({ COMMIT_REF: SHA, GITHUB_SHA: 'altro' }, git)).toBe(SHA)
  })

  it('in GitHub Actions usa GITHUB_SHA', () => {
    expect(resolveCommitSha({ GITHUB_SHA: SHA }, git)).toBe(SHA)
  })

  it('in locale chiede a git', () => {
    expect(resolveCommitSha({}, git)).toBe(git())
  })

  it('senza git né variabili scrive «unknown», che non coincide con nessuno SHA', () => {
    const noGit = () => {
      throw new Error('not a git repository')
    }
    expect(resolveCommitSha({}, noGit)).toBe('unknown')
  })
})

describe('versionFile', () => {
  let root: string
  let server: ViteDevServer | undefined

  afterEach(async () => {
    await server?.close()
    server = undefined
    if (root) rmSync(root, { recursive: true, force: true })
  })

  function project(): string {
    root = mkdtempSync(join(tmpdir(), 'entro-version-file-'))
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>prova</title>')
    return root
  }

  it(`la build scrive ${VERSION_FILE} con lo SHA`, async () => {
    const dir = project()
    await build({
      configFile: false,
      root: dir,
      logLevel: 'silent',
      plugins: [versionFile(SHA)],
      build: { outDir: join(dir, 'dist') },
    })

    expect(JSON.parse(readFileSync(join(dir, 'dist', VERSION_FILE), 'utf8'))).toEqual({ sha: SHA })
  })

  it(`il dev server serve ${VERSION_FILE}, senza cache`, async () => {
    server = await createServer({
      configFile: false,
      root: project(),
      logLevel: 'silent',
      plugins: [versionFile(SHA)],
      server: { host: '127.0.0.1', port: 0 },
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') throw new Error('dev server senza porta')

    const response = await fetch(`http://127.0.0.1:${address.port}/${VERSION_FILE}`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ sha: SHA })
  })

  it('vite.config.ts lo usa', async () => {
    const config = (await import('../vite.config')).default
    const plugins = (Array.isArray(config.plugins) ? config.plugins : []).flat()
    const names = plugins.map((plugin) => (plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined))
    expect(names).toContain(versionFile(SHA).name)
  })
})
