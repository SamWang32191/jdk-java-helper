import { describe, expect, it, vi, afterEach } from 'vitest'

import {
  discoverMacosJdkHomes,
  parseJavaHomeVersionList,
} from '../src/inventory/discover-macos.js'
import {
  discoverWindowsJdkHomes,
  parseWindowsRegistryJavaHomes,
} from '../src/inventory/discover-windows.js'
import { discoverManagerHomes } from '../src/inventory/discover-managers.js'
import {
  normalizeCandidate,
  parseJavaVersionOutput,
  validateHome,
  validateCandidates,
} from '../src/inventory/validate-candidates.js'

describe('parseJavaVersionOutput', () => {
  it('parses java -version output into major and fullVersion', () => {
    expect(parseJavaVersionOutput(`openjdk version "17.0.10" 2024-01-16\nOpenJDK Runtime Environment ...`)).toEqual({
      major: 17,
      fullVersion: '17.0.10',
      vendor: 'openjdk',
      arch: 'unknown',
    })
  })

  it('parses java 8 output into major 8', () => {
    expect(parseJavaVersionOutput(`java version "1.8.0_402"\nJava(TM) SE Runtime Environment ...`)).toEqual({
      major: 8,
      fullVersion: '1.8.0_402',
      vendor: 'java',
      arch: 'unknown',
    })
  })

  it('returns null for invalid output', () => {
    expect(parseJavaVersionOutput('not a java version line')).toBeNull()
  })
})

describe('normalizeCandidate', () => {
  it('produces a complete candidate shape', () => {
    expect(
      normalizeCandidate({
        javaHome: '/opt/jdks/temurin-17',
        major: 17,
        fullVersion: '17.0.10',
        vendor: 'eclipse temurin',
        arch: 'aarch64',
        source: 'manual',
        platform: 'darwin',
      }),
    ).toEqual({
      javaHome: '/opt/jdks/temurin-17',
      javaBin: '/opt/jdks/temurin-17/bin/java',
      javacBin: '/opt/jdks/temurin-17/bin/javac',
      major: 17,
      fullVersion: '17.0.10',
      vendor: 'eclipse temurin',
      source: 'manual',
      validated: false,
      arch: 'aarch64',
    })
  })

  it('uses win32 exe paths for manual source on Windows', () => {
    expect(
      normalizeCandidate({
        javaHome: 'C:\\Java\\temurin-17',
        major: 17,
        fullVersion: '17.0.10',
        vendor: 'eclipse temurin',
        arch: 'amd64',
        source: 'manual',
        platform: 'win32',
      }),
    ).toEqual({
      javaHome: 'C:\\Java\\temurin-17',
      javaBin: 'C:\\Java\\temurin-17\\bin\\java.exe',
      javacBin: 'C:\\Java\\temurin-17\\bin\\javac.exe',
      major: 17,
      fullVersion: '17.0.10',
      vendor: 'eclipse temurin',
      source: 'manual',
      validated: false,
      arch: 'amd64',
    })
  })
})

describe('validateHome', () => {
  it('validates a home and returns a normalized candidate', async () => {
    const result = await validateHome('/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home', 'darwin', {
      spawnSync: vi.fn().mockReturnValue({
        status: 0,
        stdout: '',
        stderr: 'openjdk version "17.0.10" 2024-01-16\nOpenJDK Runtime Environment ...',
      }) as any,
      source: 'manual',
    })

    expect(result).toEqual({
      javaHome: '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home',
      javaBin: '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java',
      javacBin: '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/javac',
      major: 17,
      fullVersion: '17.0.10',
      vendor: 'openjdk',
      source: 'manual',
      validated: true,
      arch: 'unknown',
    })
  })

  it('uses win32 executable paths for manual source on Windows', async () => {
    const result = await validateHome('C:\\Java\\temurin-17', 'win32', {
      spawnSync: vi.fn().mockReturnValue({
        status: 0,
        stdout: '',
        stderr: 'openjdk version "17.0.10" 2024-01-16\nOpenJDK Runtime Environment ...',
      }) as any,
      source: 'manual',
    })

    expect(result).toEqual({
      javaHome: 'C:\\Java\\temurin-17',
      javaBin: 'C:\\Java\\temurin-17\\bin\\java.exe',
      javacBin: 'C:\\Java\\temurin-17\\bin\\javac.exe',
      major: 17,
      fullVersion: '17.0.10',
      vendor: 'openjdk',
      source: 'manual',
      validated: true,
      arch: 'unknown',
    })
  })

  it('rejects a home when javac is missing', async () => {
    const spawnSync = vi.fn()
      .mockReturnValueOnce({
        status: 0,
        stdout: '',
        stderr: 'openjdk version "17.0.10" 2024-01-16\nOpenJDK Runtime Environment ...',
      })
      .mockReturnValueOnce({
        status: 1,
        stdout: '',
        stderr: 'javac: command not found',
      }) as any

    await expect(
      validateHome('/Library/Java/JavaVirtualMachines/jre-only/Contents/Home', 'darwin', {
        spawnSync,
        source: 'manual',
      }),
    ).resolves.toBeNull()
  })
})

describe('discoverMacosJdkHomes', () => {
  afterEach(() => vi.restoreAllMocks())

  it('includes java_home -V and directory scan results', async () => {
    const javaHomeOutput = `Matching Java Virtual Machines (1):\n    17.0.10 (arm64) "Temurin" - "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"`
    const spawnSync = vi.fn().mockReturnValue({
      status: 0,
      stdout: '',
      stderr: javaHomeOutput,
    }) as any

    await expect(
      discoverMacosJdkHomes({
        commandRunner: { spawnSync },
        directoryListings: {
          '/Library/Java/JavaVirtualMachines': ['temurin-21'],
        },
      }),
    ).resolves.toEqual([
      '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home',
      '/Library/Java/JavaVirtualMachines/temurin-21/Contents/Home',
    ])

    expect(spawnSync).toHaveBeenCalledWith('/usr/libexec/java_home', ['-V'], expect.any(Object))
  })
})

describe('parseJavaHomeVersionList', () => {
  it('extracts homes from java_home -V output', () => {
    expect(
      parseJavaHomeVersionList(`Matching Java Virtual Machines (1):\n    17.0.10 (arm64) "Temurin" - "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"`),
    ).toEqual(['/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home'])
  })
})

describe('discoverWindowsJdkHomes', () => {
  afterEach(() => vi.restoreAllMocks())

  it('includes registry and directory scan results', async () => {
    const spawnSync = vi.fn().mockReturnValue({
      status: 0,
      stdout: [
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\JDK\\17',
        '    JavaHome    REG_SZ    C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot',
        '    CurrentVersion    REG_SZ    17',
      ].join('\n'),
      stderr: '',
    }) as any

    await expect(
      discoverWindowsJdkHomes({
        commandRunner: { spawnSync },
        directoryListings: {
          'C:\\Program Files\\Java': ['jdk-17'],
        },
      }),
    ).resolves.toEqual([
      'C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot',
      'C:\\Program Files\\Java\\jdk-17',
    ])

    expect(spawnSync).toHaveBeenCalledWith('reg', ['query', 'HKLM\\SOFTWARE\\JavaSoft\\JDK', '/s'], expect.any(Object))
  })
})

describe('parseWindowsRegistryJavaHomes', () => {
  it('extracts only JavaHome entries from registry output', () => {
    expect(
      parseWindowsRegistryJavaHomes([
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\JavaSoft\\JDK\\17',
        '    JavaHome    REG_SZ    C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot',
        '    CurrentVersion    REG_SZ    17',
      ].join('\n')),
    ).toEqual(['C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.2.13-hotspot'])
  })
})

describe('discoverManagerHomes', () => {
  it('discovers installs from a supplied home dir', async () => {
    await expect(
      discoverManagerHomes('/Users/alice', {
        directoryListings: {
          '/Users/alice/.sdkman/candidates/java': ['17.0.10-tem'],
          '/Users/alice/.asdf/installs/java': ['21.0.2'],
          '/Users/alice/.local/share/mise/installs/java': ['25.0.1'],
        },
      }),
    ).resolves.toEqual([
      { home: '/Users/alice/.sdkman/candidates/java/17.0.10-tem', source: 'sdkman' },
      { home: '/Users/alice/.asdf/installs/java/21.0.2', source: 'asdf' },
      { home: '/Users/alice/.local/share/mise/installs/java/25.0.1', source: 'mise' },
    ])
  })
})

describe('validateCandidates', () => {
  it('keeps source buckets when validating manager homes', async () => {
    const result = await validateCandidates([
      { home: '/Users/alice/.sdkman/candidates/java/17.0.10-tem', source: 'sdkman' },
      { home: '/Users/alice/.asdf/installs/java/21.0.2', source: 'asdf' },
      { home: '/Users/alice/.local/share/mise/installs/java/25.0.1', source: 'mise' },
    ], 'darwin', {
      spawnSync: vi.fn()
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'openjdk version "17.0.10" 2024-01-16' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'javac 17.0.10' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'openjdk version "21.0.2" 2024-01-16' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'javac 21.0.2' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'openjdk version "25.0.1" 2025-01-16' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: 'javac 25.0.1' }) as any,
    })

    expect(result.map((candidate) => candidate.source)).toEqual(['sdkman', 'asdf', 'mise'])
  })
})
