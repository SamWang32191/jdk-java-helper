import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { afterAll, expect, it } from 'vitest'

const opencodeBin = process.env.OPENCODE_BIN ?? 'opencode'

let hasOpenCode = false
if (process.env.OPENCODE_SMOKE === '1') {
  try {
    execFileSync(opencodeBin, ['--version'], { stdio: 'ignore', timeout: 10_000 })
    hasOpenCode = true
  } catch {
    hasOpenCode = false
  }
}

const tempDirs: string[] =
  (globalThis as typeof globalThis & { __OPENCODE_SMOKE_TEMP_DIRS__?: string[] })
    .__OPENCODE_SMOKE_TEMP_DIRS__ ?? []

;(globalThis as typeof globalThis & { __OPENCODE_SMOKE_TEMP_DIRS__?: string[] }).__OPENCODE_SMOKE_TEMP_DIRS__ = tempDirs

afterAll(() => {
  for (const dir of tempDirs) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // ignore cleanup failures
    }
  }
})

it.runIf(process.env.OPENCODE_SMOKE === '1' && hasOpenCode)(
  'loads the packed plugin through OpenCode without target discovery errors',
  () => {
    const repoRoot = resolve(import.meta.dirname, '../../..')
    const tempRoot = mkdtempSync(join(tmpdir(), 'opencode-plugin-smoke-'))
    tempDirs.push(tempRoot)

    const packDir = join(tempRoot, 'pack')
    const configDir = join(tempRoot, 'config')
    const configFile = join(configDir, 'opencode.json')
    mkdirSync(packDir, { recursive: true })
    mkdirSync(configDir, { recursive: true })

    execFileSync('npm', ['run', 'build', '--workspace', 'packages/opencode-plugin'], {
      cwd: repoRoot,
      stdio: 'ignore',
      timeout: 120_000,
    })

    const packed = execFileSync(
      'npm',
      ['pack', '--workspace', 'packages/opencode-plugin', '--pack-destination', packDir],
      { cwd: repoRoot, encoding: 'utf8', timeout: 120_000 },
    ).trim().split('\n').at(-1)

    expect(packed).toBeTruthy()

    writeFileSync(
      configFile,
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          plugin: [`file:${join(packDir, packed!)}`],
        },
        null,
        2,
      ),
    )

    const result = spawnSync(
      opencodeBin,
      ['--print-logs', '--log-level', 'DEBUG', 'session', 'list', '--format', 'json'],
      {
        cwd: tempRoot,
        env: {
          ...process.env,
          OPENCODE_CONFIG: configFile,
          OPENCODE_CONFIG_DIR: configDir,
          OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
        },
        encoding: 'utf8',
        timeout: 120_000,
      },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toContain('loading plugin')
    expect(result.stderr).toContain(packed)
    expect(result.stderr).not.toContain('No plugin targets found')
    expect(result.stderr).not.toContain('resolved server entry outside plugin directory')
    expect(result.stdout).not.toContain('No plugin targets found')
    expect(result.stdout).not.toContain('resolved server entry outside plugin directory')
  },
  30000,
)
