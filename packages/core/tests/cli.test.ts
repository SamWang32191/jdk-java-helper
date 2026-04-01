import { describe, expect, it } from 'vitest'

describe('runCli', () => {
  it('prints explain output for a resolved JDK', async () => {
    const { runCli } = await import('../src/cli.js')

    const output = await runCli(['explain', '--cwd', '/workspace', '--command', 'make JAVA=17 test'], {
      resolve: async () => ({
        kind: 'resolved' as const,
        major: 17,
        env: { JAVA_HOME: '/jdks/17', PATH: '/jdks/17/bin:/usr/bin' },
        projectRoot: '/workspace',
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
          usedSignals: [{ major: 17, source: 'command' as const, detail: 'JAVA=17' }],
          usedSources: ['command' as const],
          ignoredSources: ['version-file' as const, 'maven' as const],
          examinedSources: ['command' as const],
          installedJdkMajors: [17, 21],
        },
      }),
    })

    expect(output).toContain('Selected Java major: 17')
    expect(output).toContain('JAVA_HOME=/jdks/17')
  })

  it('writes explain output when invoked through the CLI entrypoint', async () => {
    const { runCliMain } = await import('../src/cli.js')
    let stdout = ''
    let stderr = ''

    const exitCode = await runCliMain(
      ['explain', '--cwd', '/workspace', '--command', 'make JAVA=17 test'],
      {
        stdout: (chunk: string) => {
          stdout += chunk
        },
        stderr: (chunk: string) => {
          stderr += chunk
        },
      },
      {
        resolve: async () => ({
          kind: 'resolved' as const,
          major: 17,
          env: { JAVA_HOME: '/jdks/17', PATH: '/jdks/17/bin:/usr/bin' },
          projectRoot: '/workspace',
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
            usedSignals: [{ major: 17, source: 'command' as const, detail: 'JAVA=17' }],
            usedSources: ['command' as const],
            ignoredSources: ['version-file' as const, 'maven' as const],
            examinedSources: ['command' as const],
            installedJdkMajors: [17, 21],
          },
        }),
      },
    )

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(stdout).toContain('Selected Java major: 17')
  })
})
