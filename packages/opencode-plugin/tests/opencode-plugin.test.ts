import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createOpenCodePlugin } from '../src/index.js'
import type { ResolveResult } from '@jdk-auto-switch/core'

const corePackageJsonUrl = new URL('../../core/package.json', import.meta.url)
const coreDistJsUrl = new URL('../../core/dist/index.js', import.meta.url)

describe('OpenCode adapter', () => {
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

    const plugin = createOpenCodePlugin({ resolveJdk })
    expect(plugin['shell.env']).toBeTypeOf('function')

    const result = await plugin['shell.env']({
      cwd: '/workspace/project',
      command: 'mvn test',
      env: { PATH: '/usr/bin' },
      tool: 'shell',
    }, { env: { PATH: '/usr/bin' } })

    expect(resolveJdk).toHaveBeenCalledWith({
      cwd: '/workspace/project',
      command: 'mvn test',
      platform: process.platform,
      env: { PATH: '/usr/bin' },
    })
    expect(result.JAVA_HOME).toBe('/jdks/17')
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

    const plugin = createOpenCodePlugin({ resolveJdk })

    await expect(
      plugin['shell.env'](
        {
          cwd: '/workspace/project',
          command: 'mvn test',
          env: { PATH: '/usr/bin' },
          tool: 'shell',
        },
        { env: { PATH: '/usr/bin' } },
      ),
    ).resolves.toEqual({ PATH: '/usr/bin' })
  })

  it('blocks unresolved shell tool execution when the project is recognized but JDK is missing', async () => {
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
    const plugin = createOpenCodePlugin({ resolveJdk })

    await expect(
      plugin['tool.execute.before']({
        cwd: '/workspace/project',
        command: 'mvn test',
        env: { PATH: '/usr/bin' },
        tool: 'shell',
      }, { env: { PATH: '/usr/bin' } }),
    ).rejects.toThrow(/JDK_NOT_FOUND/)

    await expect(
      plugin['tool.execute.before']({
        cwd: '/workspace/project',
        command: 'mvn test',
        env: { PATH: '/usr/bin' },
        tool: 'editor',
      }, { env: { PATH: '/usr/bin' } }),
    ).resolves.toEqual({ env: { PATH: '/usr/bin' } })

    expect(resolveJdk).toHaveBeenCalledTimes(1)
  })

  it('treats shell and bash the same for tool blocking, but passes through NO_PROJECT', async () => {
    const resolveJdk = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'unresolved' as const,
        code: 'NO_PROJECT' as const,
        reasons: ['No pom.xml found in current working directory hierarchy.'],
        projectRoot: '/tmp',
        command: 'mvn test',
        sourcesExamined: [] as const,
        installedJdkMajors: [],
        suggestedNextAction: 'Run the command from inside a Maven project.',
      } satisfies Extract<ResolveResult, { kind: 'unresolved' }>)
      .mockResolvedValueOnce({
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

    const plugin = createOpenCodePlugin({ resolveJdk })

    await expect(
      plugin['tool.execute.before'](
        {
          cwd: '/tmp',
          command: 'mvn test',
          env: { PATH: '/usr/bin' },
          tool: 'bash',
        },
        { env: { PATH: '/usr/bin' } },
      ),
    ).resolves.toEqual({ env: { PATH: '/usr/bin' } })

    await expect(
      plugin['tool.execute.before'](
        {
          cwd: '/workspace/project',
          command: 'mvn test',
          env: { PATH: '/usr/bin' },
          tool: 'shell',
        },
        { env: { PATH: '/usr/bin' } },
      ),
    ).rejects.toThrow(/JDK_NOT_FOUND/)
  })
})
