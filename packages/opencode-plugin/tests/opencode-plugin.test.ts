import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import pluginModule, { createOpenCodePlugin, server } from '../src/index.js'
import type { ResolveInput, ResolveResult } from '@jdk-auto-switch/core'

const opencodePackageJsonUrl = new URL('../package.json', import.meta.url)

const selectedJdk = {
  major: 17,
  fullVersion: '17.0.13',
  javaHome: '/jdks/17',
  javaBin: '/jdks/17/bin/java',
  javacBin: '/jdks/17/bin/javac',
  vendor: 'Temurin',
  source: 'manual' as const,
  validated: true,
  arch: 'arm64',
}

type PluginDependencies = {
  resolveJdk: (input: ResolveInput) => Promise<ResolveResult>
  env: ResolveInput['env']
}

const createPlugin = ({ resolveJdk, env }: PluginDependencies) =>
  createOpenCodePlugin({
    resolveJdk,
    env,
  })

const createResolvedResult = () => ({
  kind: 'resolved' as const,
  env: {
    JAVA_HOME: '/jdks/17',
    PATH: '/jdks/17/bin:/usr/bin',
  },
  projectRoot: '/workspace/project',
  major: 17,
  candidate: {
    ...selectedJdk,
  },
  diagnostics: {
    selectedJdk,
    whySelected: 'exact command override',
    usedSignals: [],
    usedSources: ['command'] as const,
    ignoredSources: [],
    examinedSources: ['command'] as const,
    installedJdkMajors: [17],
  },
} satisfies Extract<ResolveResult, { kind: 'resolved' }>)

const createUnresolvedResult = (code: 'NO_SIGNAL' | 'JDK_NOT_FOUND' | 'NO_PROJECT') => ({
  kind: 'unresolved' as const,
  code,
  reasons: ['No explicit Java signal found.'],
  projectRoot: '/workspace/project',
  command: 'mvn test',
  sourcesExamined: ['command'] as const,
  installedJdkMajors: [],
  suggestedNextAction: 'Add an explicit command override or a repo Java version file.',
} satisfies Extract<ResolveResult, { kind: 'unresolved' }>)

const createJdkNotFoundResult = () => ({
  kind: 'unresolved' as const,
  code: 'JDK_NOT_FOUND' as const,
  reasons: ['Missing JDK 17.'],
  projectRoot: '/workspace/project',
  command: 'mvn test',
  sourcesExamined: ['command'] as const,
  versionFound: [17],
  installedJdkMajors: [21],
  suggestedNextAction: 'install JDK 17',
} satisfies Extract<ResolveResult, { kind: 'unresolved' }>)

describe('OpenCode npm plugin contract', () => {
  it('uses a package-local vitest config so npm test works from the package directory', () => {
    const packageJson = JSON.parse(readFileSync(opencodePackageJsonUrl, 'utf8')) as {
      scripts?: { test?: string }
    }

    expect(packageJson.scripts?.test).toBe('vitest run --config vitest.config.ts')
  })

  it('declares package exports for OpenCode loader discovery', () => {
    const packageJson = JSON.parse(
      readFileSync(opencodePackageJsonUrl, 'utf8'),
    ) as { exports?: { '.': { types?: string; default?: string } } }

    expect(packageJson.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(packageJson.exports?.['.'].default).toBe('./dist/index.js')
  })

  it('declares a server plugin target for OpenCode loader discovery', () => {
    const packageJson = JSON.parse(
      readFileSync(opencodePackageJsonUrl, 'utf8'),
    ) as { 'oc-plugin'?: string[] }

    expect(packageJson['oc-plugin']).toEqual(['server'])
  })

  it('exports a server entry', () => {
    expect(pluginModule.server).toBe(server)
    expect(server).toBeTypeOf('function')
  })

  it('creates OpenCode hooks from the exported server entry', async () => {
    const plugin = await pluginModule.server({
      project: {} as never,
      client: {} as never,
      directory: '/workspace/project',
      worktree: '/workspace/project',
      serverUrl: new URL('http://127.0.0.1:4096'),
      $: {} as never,
    })

    expect(plugin['shell.env']).toBeTypeOf('function')
    expect(plugin['tool.execute.before']).toBeTypeOf('function')
  })

  it('injects JAVA_HOME from resolver env into shell.env hook', async () => {
    const resolveJdk = vi.fn(async () => createResolvedResult())
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    expect(plugin['shell.env']).toBeTypeOf('function')

    const output: { env: Record<string, string> } = { env: { PATH: '/usr/bin' } }

    await plugin['shell.env']!({
      cwd: '/workspace/project',
    }, output)

    expect(resolveJdk).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      command: '',
      platform: process.platform,
      env: { PATH: '/usr/bin' },
    })
    expect(output.env.JAVA_HOME).toBe('/jdks/17')
    expect(output.env.PATH).toBe('/jdks/17/bin:/usr/bin')
  })

  it('falls back to the original env when shell.env cannot resolve a JDK', async () => {
    const resolveJdk = vi.fn(async () => createUnresolvedResult('NO_SIGNAL'))
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output: { env: Record<string, string> } = { env: { PATH: '/usr/bin' } }

    await expect(
      plugin['shell.env']!(
        {
          cwd: '/workspace/project',
        },
        output,
      ),
    ).resolves.toBeUndefined()
    expect(output.env).toEqual({ PATH: '/usr/bin' })
  })

  it('rewrites bash commands with resolved env before execution', async () => {
    const resolveJdk = vi.fn(async () => createResolvedResult())
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output = {
      args: {
        command: 'mvn test',
        workdir: '/workspace/project',
      },
    }

    await plugin['tool.execute.before']!({
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
    const rewritten = String(output.args.command)
    expect(rewritten).not.toBe('mvn test')
    expect(rewritten).toContain('JAVA_HOME')
    expect(rewritten).toContain('PATH')
    expect(rewritten.indexOf('JAVA_HOME')).toBeLessThan(rewritten.indexOf('mvn test'))
    expect(rewritten.indexOf('PATH')).toBeLessThan(rewritten.indexOf('mvn test'))
  })

  it('blocks unresolved bash execution when the project is recognized but JDK is missing', async () => {
    const resolveJdk = vi.fn(async () => createJdkNotFoundResult())
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output = {
      args: {
        command: 'mvn test',
        workdir: '/workspace/project',
      },
    }

    await expect(
      plugin['tool.execute.before']!({
        tool: 'bash',
        sessionID: 'session-2',
        callID: 'call-2',
      }, output),
    ).rejects.toThrow(/JDK_NOT_FOUND/)

    expect(output.args).toEqual({
      command: 'mvn test',
      workdir: '/workspace/project',
    })
    expect(resolveJdk).toHaveBeenCalledTimes(1)
  })

  it('ignores non-bash hook calls even when JDK is missing', async () => {
    const resolveJdk = vi.fn(async () => createJdkNotFoundResult())
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output = {
      args: {
        command: 'mvn test',
        workdir: '/workspace/project',
      },
    }

    await expect(
      plugin['tool.execute.before']!({
        tool: 'editor',
        sessionID: 'session-3',
        callID: 'call-3',
      }, output),
    ).resolves.toBeUndefined()

    expect(output.args).toEqual({
      command: 'mvn test',
      workdir: '/workspace/project',
    })
    expect(resolveJdk).not.toHaveBeenCalled()
  })

  it('passes through NO_PROJECT for bash commands', async () => {
    const resolveJdk = vi.fn(async () => createUnresolvedResult('NO_PROJECT'))
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output = {
      args: {
        command: 'mvn test',
        workdir: '/tmp',
      },
    }

    await expect(
      plugin['tool.execute.before']!({
        tool: 'bash',
        sessionID: 'session-4',
        callID: 'call-4',
      }, output),
    ).resolves.toBeUndefined()

    expect(output.args.command).toBe('mvn test')
    expect(resolveJdk).toHaveBeenCalledTimes(1)
  })

  it('ignores bash hook calls without a command string', async () => {
    const resolveJdk = vi.fn()
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })
    const output = {
      args: {},
    }

    await expect(
      plugin['tool.execute.before']!({
        tool: 'bash',
        sessionID: 'session-5',
        callID: 'call-5',
      }, output),
    ).resolves.toBeUndefined()

    expect(output.args).toEqual({})
    expect(resolveJdk).not.toHaveBeenCalled()
  })

  it('ignores non-bash hook calls even with a command string', async () => {
    const resolveJdk = vi.fn()
    const plugin = createPlugin({ resolveJdk, env: { PATH: '/usr/bin' } })

    await expect(
      plugin['tool.execute.before']!({
        tool: 'editor',
        sessionID: 'session-6',
        callID: 'call-6',
      }, {
        args: {
          command: 'mvn test',
          workdir: '/workspace/project',
        },
      }),
    ).resolves.toBeUndefined()

    expect(resolveJdk).not.toHaveBeenCalled()
  })
})
