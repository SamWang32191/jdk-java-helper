import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { discoverInventory, formatDoctor, formatExplain, resolveJdk } from '../src/index.js'

const fixturePath = (name: string) => path.resolve(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)))

describe('resolveJdk', () => {
  it('prefers exact command override over pom release', async () => {
    const projectRoot = fixturePath('simple-pom')

    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.major).toBe(17)
      expect(result.env.JAVA_HOME).toBe('/jdks/17')
      expect(result.diagnostics.usedSignals.map((signal) => signal.detail)).toEqual(['make JAVA=17'])
      expect(result.diagnostics.ignoredSources).toEqual([
        'version-file',
        'maven',
      ])
    }
  })

  it('prefers validated candidate over source bucket when majors tie', async () => {
    const projectRoot = fixturePath('simple-pom')

    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/manual-17',
          javaBin: '/jdks/manual-17/bin/java',
          javacBin: '/jdks/manual-17/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: false,
          arch: 'arm64',
        },
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/sdkman-17',
          javaBin: '/jdks/sdkman-17/bin/java',
          javacBin: '/jdks/sdkman-17/bin/javac',
          vendor: 'Temurin',
          source: 'sdkman',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.candidate.javaHome).toBe('/jdks/sdkman-17')
    }
  })

  it('exports discoverInventory from the public entrypoint', () => {
    expect(typeof discoverInventory).toBe('function')
  })

  it('returns fail-fast diagnostics when no exact JDK is installed', async () => {
    const projectRoot = fixturePath('simple-pom')

    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.projectRoot).toBe(projectRoot)
      expect(result.command).toBe('make JAVA=17 test')
      expect(result.sourcesExamined).toEqual(['command'])
      expect(result.installedJdkMajors).toEqual([21])
      expect(result.suggestedNextAction).toContain('install JDK 17')
    }
  })

  it('formats explain output with selection and ignored sources', async () => {
    const projectRoot = fixturePath('simple-pom')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(formatExplain(result)).toContain('Selected JDK: /jdks/17')
    expect(formatExplain(result)).toContain('Why selected: exact command override')
    expect(formatExplain(result)).toContain('Used sources: command')
    expect(formatExplain(result)).toContain('Ignored sources: version-file, maven')
  })

  it('resolves interpolated Maven signals when no higher-priority source exists', async () => {
    const projectRoot = fixturePath('interpolated-pom')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.major).toBe(21)
      expect(result.diagnostics.usedSources).toEqual(['maven'])
    }
  })

  it('returns CONFLICT for interpolated Maven signals that resolve to different majors', async () => {
    const projectRoot = fixturePath('interpolated-conflict')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('CONFLICT')
      expect(result.conflictFound).toEqual([17, 21])
    }
  })

  it('keeps fail-soft NO_SIGNAL behavior for unresolved interpolated Maven references', async () => {
    const projectRoot = fixturePath('interpolated-unresolved-all')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('NO_SIGNAL')
      expect(result.sourcesExamined).toEqual(['command', 'version-file', 'maven'])
    }
  })

  it('keeps fail-soft NO_SIGNAL behavior for cyclic interpolated Maven references', async () => {
    const projectRoot = fixturePath('interpolated-cycle')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make test',
      platform: 'darwin',
      env: {},
      inventory: [
        {
          major: 21,
          fullVersion: '21.0.7',
          javaHome: '/jdks/21',
          javaBin: '/jdks/21/bin/java',
          javacBin: '/jdks/21/bin/javac',
          vendor: 'Temurin',
          source: 'manual',
          validated: true,
          arch: 'arm64',
        },
      ],
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('NO_SIGNAL')
      expect(result.sourcesExamined).toEqual(['command', 'version-file', 'maven'])
    }
  })

  it('formats doctor output with inventory and missing majors', () => {
    expect(
      formatDoctor({
        inventory: [
          {
            major: 21,
            fullVersion: '21.0.7',
            javaHome: '/jdks/21',
            javaBin: '/jdks/21/bin/java',
            javacBin: '/jdks/21/bin/javac',
            vendor: 'Temurin',
            source: 'manual',
            validated: true,
            arch: 'arm64',
          },
        ],
        invalidJdkPaths: ['/bad/jdk'],
        missingMajors: [17],
        recentProjectNeeds: [17, 21],
      }),
    ).toContain('Discovered JDK inventory')
    expect(
      formatDoctor({
        inventory: [
          {
            major: 21,
            fullVersion: '21.0.7',
            javaHome: '/jdks/21',
            javaBin: '/jdks/21/bin/java',
            javacBin: '/jdks/21/bin/javac',
            vendor: 'Temurin',
            source: 'manual',
            validated: true,
            arch: 'arm64',
          },
        ],
        invalidJdkPaths: ['/bad/jdk'],
        missingMajors: [17],
        recentProjectNeeds: [17, 21],
      }),
    ).toContain('Invalid JDK paths: /bad/jdk')
    expect(
      formatDoctor({
        inventory: [
          {
            major: 21,
            fullVersion: '21.0.7',
            javaHome: '/jdks/21',
            javaBin: '/jdks/21/bin/java',
            javacBin: '/jdks/21/bin/javac',
            vendor: 'Temurin',
            source: 'manual',
            validated: true,
            arch: 'arm64',
          },
        ],
        invalidJdkPaths: ['/bad/jdk'],
        missingMajors: [17],
        recentProjectNeeds: [17, 21],
      }),
    ).toContain('Missing majors vs recent needs: 17')
  })
})
