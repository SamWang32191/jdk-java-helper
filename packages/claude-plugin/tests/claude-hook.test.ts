import { readFileSync } from 'node:fs'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ResolveResult } from '../../core/src/index.js'

async function loadRunHook() {
  return (await import('../scripts/jdk-hook.mjs')).runHook
}

const stubCoreDir = fileURLToPath(new URL('../node_modules/@w32191/jdk-auto-switch-core', import.meta.url))

function ensureStubCore() {
  mkdirSync(stubCoreDir, { recursive: true })
  writeFileSync(
    new URL('./package.json', new URL(`${stubCoreDir}/`, import.meta.url)),
    JSON.stringify({ name: '@w32191/jdk-auto-switch-core', type: 'module', exports: { '.': './index.mjs' } }),
  )
  writeFileSync(
    new URL('./index.mjs', new URL(`${stubCoreDir}/`, import.meta.url)),
    'export async function resolveJdk() { return { kind: "unresolved", code: "NO_PROJECT", reasons: ["stub"], projectRoot: "/workspace", command: "mvn test", sourcesExamined: [], installedJdkMajors: [], suggestedNextAction: "stub" } }\n',
  )
}

function cleanupStubCore() {
  rmSync(new URL('../node_modules/@w32191', import.meta.url), { recursive: true, force: true })
}

describe('Claude hook', () => {
  beforeAll(() => {
    ensureStubCore()
  })

  afterAll(() => {
    cleanupStubCore()
  })

  it('uses a package-local vitest config so npm test works from the package directory', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts?: { test?: string }
    }

    expect(packageJson.scripts?.test).toBe('vitest run --config vitest.config.ts')
  })

  it('writes env exports when resolver returns a JDK', async () => {
    const resolvedResult = {
      kind: 'resolved' as const,
      major: 25,
      env: { JAVA_HOME: '/jdks/25', PATH: '/jdks/25/bin:/usr/bin' },
      candidate: {
        major: 25,
        fullVersion: '25.0.1',
        javaHome: '/jdks/25',
        javaBin: '/jdks/25/bin/java',
        javacBin: '/jdks/25/bin/javac',
        vendor: 'Temurin',
        source: 'manual' as const,
        validated: true,
        arch: 'arm64',
      },
      projectRoot: '/workspace',
      diagnostics: {
        selectedJdk: {
          major: 25,
          fullVersion: '25.0.1',
          javaHome: '/jdks/25',
          javaBin: '/jdks/25/bin/java',
          javacBin: '/jdks/25/bin/javac',
          vendor: 'Temurin',
          source: 'manual' as const,
          validated: true,
          arch: 'arm64',
        },
        whySelected: 'command-level override',
        usedSignals: [],
        usedSources: [] as ResolveResult extends { kind: 'resolved'; diagnostics: { usedSources: infer T } } ? T : never,
        ignoredSources: [] as ResolveResult extends { kind: 'resolved'; diagnostics: { ignoredSources: infer T } } ? T : never,
        examinedSources: [] as ResolveResult extends { kind: 'resolved'; diagnostics: { examinedSources: infer T } } ? T : never,
        installedJdkMajors: [25],
      },
    } satisfies Extract<ResolveResult, { kind: 'resolved' }>

    const runHook = await loadRunHook()
    const result = await runHook(
      {
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'mvn test', cwd: '/workspace' },
      },
      {
        resolve: async () => resolvedResult,
      },
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('export JAVA_HOME="/jdks/25"')
  })

  it('returns a clean no-op for NO_PROJECT', async () => {
    const runHook = await loadRunHook()
    const result = await runHook(
      {
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'mvn test', cwd: '/workspace' },
      },
      {
        resolve: vi.fn(async () => ({
          kind: 'unresolved' as const,
          code: 'NO_PROJECT' as const,
          reasons: ['No pom.xml found.'],
          projectRoot: '/workspace',
          command: 'mvn test',
          sourcesExamined: [],
          installedJdkMajors: [],
          suggestedNextAction: 'Run inside a Maven project.',
        } satisfies Extract<ResolveResult, { kind: 'unresolved' }>)),
      },
    )

    expect(result).toEqual({ exitCode: 0, stdout: '' })
  })

  it('blocks unresolved non-NO_PROJECT results', async () => {
    const runHook = await loadRunHook()
    const result = await runHook(
      {
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'mvn test', cwd: '/workspace' },
      },
      {
        resolve: vi.fn(async () => ({
          kind: 'unresolved' as const,
          code: 'JDK_NOT_FOUND' as const,
          reasons: ['Missing JDK 17.', 'Installed JDK majors: 21'],
          projectRoot: '/workspace',
          command: 'mvn test',
          sourcesExamined: ['command'] as const,
          versionFound: [17],
          installedJdkMajors: [21],
          suggestedNextAction: 'install JDK 17',
        } satisfies Extract<ResolveResult, { kind: 'unresolved' }>)),
      },
    )

    expect(result.exitCode).toBe(2)
    expect(result.stdout).toContain('Missing JDK 17.')
  })

  it('normalizes top-level payload cwd and command for CwdChanged', async () => {
    const resolve = vi.fn(async () => ({
      kind: 'unresolved' as const,
      code: 'NO_PROJECT' as const,
      reasons: ['No pom.xml found.'],
      projectRoot: '/workspace',
      command: '',
      sourcesExamined: [],
      installedJdkMajors: [],
      suggestedNextAction: 'Run inside a Maven project.',
    } satisfies Extract<ResolveResult, { kind: 'unresolved' }>))

    const runHook = await loadRunHook()
    await runHook(
      {
        event: 'CwdChanged',
        cwd: '/workspace/project',
        command: 'mvn test',
      },
      { resolve },
    )

    expect(resolve).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      command: 'mvn test',
      platform: process.platform,
      env: process.env,
    })
  })

  it('supports the stdin/stdout entrypoint path', () => {
    const scriptUrl = new URL('../scripts/jdk-hook.mjs', import.meta.url)

    let result: ReturnType<typeof spawnSync>
    result = spawnSync(process.execPath, [scriptUrl.pathname], {
      input: JSON.stringify({
        event: 'PreToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'mvn test', cwd: '/workspace' },
      }),
      encoding: 'utf8',
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
  })
})
