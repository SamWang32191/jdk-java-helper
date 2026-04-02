import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import defaultPlugin, { createOpenCodePlugin } from '../src/index.js'
import type { ResolveResult } from '@jdk-auto-switch/core'

const corePackageJsonUrl = new URL('../../core/package.json', import.meta.url)
const coreDistJsUrl = new URL('../../core/dist/index.js', import.meta.url)
const opencodePackageJsonUrl = new URL('../package.json', import.meta.url)

describe('OpenCode adapter', () => {
  it('exposes a package export contract pointed at dist artifacts', () => {
    const packageJson = JSON.parse(
      readFileSync(opencodePackageJsonUrl, 'utf8'),
    ) as { exports?: { '.': { types?: string; default?: string } } }

    expect(packageJson.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(packageJson.exports?.['.'].default).toBe('./dist/index.js')
    expect(String(packageJson.exports?.['.'].types)).not.toContain('src/')
    expect(String(packageJson.exports?.['.'].default)).not.toContain('src/')
  })

  it('keeps the core package export contract pointed at dist artifacts', () => {
    const packageJson = JSON.parse(
      readFileSync(corePackageJsonUrl, 'utf8'),
    ) as { exports?: { '.': { types?: string; default?: string } } }
    const distJs = readFileSync(coreDistJsUrl, 'utf8')

    expect(packageJson.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(packageJson.exports?.['.'].default).toBe('./dist/index.js')
    expect(String(packageJson.exports?.['.'].types)).not.toContain('src/')
    expect(String(packageJson.exports?.['.'].default)).not.toContain('src/')
    expect(distJs).not.toMatch(/src\/[^\n]*\.ts/)
  })

  it('exposes a default plugin entry for OpenCode usage', () => {
    expect(defaultPlugin).toBeTypeOf('function')
  })

  it('creates OpenCode hooks from the default plugin entry', async () => {
    const plugin = await defaultPlugin({} as never)

    expect(plugin['shell.env']).toBeTypeOf('function')
    expect(plugin['tool.execute.before']).toBeTypeOf('function')
  })

  it('injects JAVA_HOME from resolver env into shell.env hook', async () => {
    const resolvedResult = {
      kind: 'resolved' as const,
      major: 17,
      env: {
        JAVA_HOME: '/jdks/17',
        PATH: '/jdks/17/bin:/usr/bin',
      },
      candidate: {
        major: 17,
        fullVersion: '17.0.13',
        javaHome: '/jdks/17',
        javaBin: '/jdks/17/bin/java',
        javacBin: '/jdks/17/bin/javac',
        vendor: 'Temurin',
        source: 'manual' as const,
        validated: true,
        arch: 'arm64',
      },
      projectRoot: '/workspace/project',
      diagnostics: {
        selectedJdk: {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'manual' as const,
          validated: true,
          arch: 'arm64',
        },
        whySelected: 'exact command override',
        usedSignals: [],
        usedSources: ['command'] as const,
        ignoredSources: [] as ResolveResult extends { kind: 'resolved'; diagnostics: { ignoredSources: infer T } } ? T : never,
        examinedSources: ['command'] as const,
        installedJdkMajors: [17],
      },
    } satisfies Extract<ResolveResult, { kind: 'resolved' }>

    const resolveJdk = vi.fn(async () => resolvedResult)

    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })
    expect(plugin['shell.env']).toBeTypeOf('function')

    const output: { env: Record<string, string> } = { env: { PATH: '/usr/bin' } }

    await plugin['shell.env']({
      cwd: '/workspace/project',
    }, output)

    expect(resolveJdk).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      command: '',
      platform: process.platform,
      env: { PATH: '/usr/bin' },
    })
    expect(output.env.JAVA_HOME).toBe('/jdks/17')
  })

  it('falls back to the original env when shell.env cannot resolve a JDK', async () => {
    const resolveJdk = vi.fn(async () => ({
      kind: 'unresolved' as const,
      code: 'NO_SIGNAL' as const,
      reasons: ['No explicit Java signal found.'],
      projectRoot: '/workspace/project',
      command: 'mvn test',
      sourcesExamined: ['command'] as const,
      installedJdkMajors: [],
      suggestedNextAction: 'Add an explicit command override or a repo Java version file.',
    } satisfies Extract<ResolveResult, { kind: 'unresolved' }>))

    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })
    const output: { env: Record<string, string> } = { env: { PATH: '/usr/bin' } }

    await expect(
      plugin['shell.env'](
        {
          cwd: '/workspace/project',
        },
        output,
      ),
    ).resolves.toBeUndefined()
    expect(output.env).toEqual({ PATH: '/usr/bin' })
  })

  it('rewrites bash commands with resolved env before execution', async () => {
    const resolvedResult = {
      kind: 'resolved' as const,
      major: 17,
      env: {
        JAVA_HOME: '/jdks/17',
        PATH: '/jdks/17/bin:/usr/bin',
      },
      candidate: {
        major: 17,
        fullVersion: '17.0.13',
        javaHome: '/jdks/17',
        javaBin: '/jdks/17/bin/java',
        javacBin: '/jdks/17/bin/javac',
        vendor: 'Temurin',
        source: 'manual' as const,
        validated: true,
        arch: 'arm64',
      },
      projectRoot: '/workspace/project',
      diagnostics: {
        selectedJdk: {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'manual' as const,
          validated: true,
          arch: 'arm64',
        },
        whySelected: 'exact command override',
        usedSignals: [],
        usedSources: ['command'] as const,
        ignoredSources: [] as ResolveResult extends { kind: 'resolved'; diagnostics: { ignoredSources: infer T } } ? T : never,
        examinedSources: ['command'] as const,
        installedJdkMajors: [17],
      },
    } satisfies Extract<ResolveResult, { kind: 'resolved' }>

    const resolveJdk = vi.fn(async () => resolvedResult)
    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })
    const output = {
      args: {
        command: 'mvn test',
        workdir: '/workspace/project',
      },
    }

    await plugin['tool.execute.before']({
      tool: 'bash',
      sessionID: 'session-1',
      callID: 'call-1',
    }, output)

    expect(resolveJdk).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      command: 'mvn test',
      platform: process.platform,
      env: { PATH: '/usr/bin' },
    })
    expect(String(output.args.command)).toContain("export JAVA_HOME='/jdks/17'")
    expect(String(output.args.command)).toContain("export PATH='/jdks/17/bin:/usr/bin'")
    expect(String(output.args.command)).toContain('mvn test')
  })

  it('blocks unresolved bash execution when the project is recognized but JDK is missing', async () => {
    const unresolvedResult = {
      kind: 'unresolved' as const,
      code: 'JDK_NOT_FOUND' as const,
      reasons: ['Missing JDK 17.'],
      projectRoot: '/workspace/project',
      command: 'mvn test',
      sourcesExamined: ['command'] as const,
      versionFound: [17],
      installedJdkMajors: [21],
      suggestedNextAction: 'install JDK 17',
    } satisfies Extract<ResolveResult, { kind: 'unresolved' }>

    const resolveJdk = vi.fn(async () => unresolvedResult)
    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })

    await expect(
      plugin['tool.execute.before']({
        tool: 'bash',
        sessionID: 'session-2',
        callID: 'call-2',
      }, {
        args: {
          command: 'mvn test',
          workdir: '/workspace/project',
        },
      }),
    ).rejects.toThrow(/JDK_NOT_FOUND/)

    await expect(
      plugin['tool.execute.before']({
        tool: 'editor',
        sessionID: 'session-3',
        callID: 'call-3',
      }, {
        args: {
          command: 'mvn test',
          workdir: '/workspace/project',
        },
      }),
    ).resolves.toBeUndefined()

    expect(resolveJdk).toHaveBeenCalledTimes(1)
  })

  it('passes through NO_PROJECT for bash commands', async () => {
    const resolveJdk = vi.fn(async () => ({
      kind: 'unresolved' as const,
      code: 'NO_PROJECT' as const,
      reasons: ['No pom.xml found in current working directory hierarchy.'],
      projectRoot: '/tmp',
      command: 'mvn test',
      sourcesExamined: [] as const,
      installedJdkMajors: [],
      suggestedNextAction: 'Run the command from inside a Maven project.',
    } satisfies Extract<ResolveResult, { kind: 'unresolved' }>))

    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })

    await expect(
      plugin['tool.execute.before']({
        tool: 'bash',
        sessionID: 'session-4',
        callID: 'call-4',
      }, {
        args: {
          command: 'mvn test',
          workdir: '/tmp',
        },
      }),
    ).resolves.toBeUndefined()

    expect(resolveJdk).toHaveBeenCalledTimes(1)
  })

  it('ignores bash hook calls without a command string', async () => {
    const resolveJdk = vi.fn()
    const plugin = createOpenCodePlugin({
      resolveJdk,
      env: { PATH: '/usr/bin' },
    })

    await expect(
      plugin['tool.execute.before']({
        tool: 'editor',
        sessionID: 'session-5',
        callID: 'call-5',
      }, {
        args: {
          workdir: '/workspace/project',
        },
      }),
    ).resolves.toBeUndefined()

    expect(resolveJdk).not.toHaveBeenCalled()
  })
})
