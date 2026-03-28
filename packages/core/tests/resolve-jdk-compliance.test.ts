import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/inventory/discover-macos.js', () => ({
  discoverMacosJdkHomes: vi.fn(async () => []),
}))

vi.mock('../src/inventory/discover-windows.js', () => ({
  discoverWindowsJdkHomes: vi.fn(async () => []),
}))

vi.mock('../src/inventory/discover-managers.js', () => ({
  discoverManagerHomes: vi.fn(async () => [
    { home: '/Users/alice/.sdkman/candidates/java/17.0.10-tem', source: 'sdkman' },
    { home: '/Users/alice/.asdf/installs/java/21.0.2', source: 'asdf' },
    { home: '/Users/alice/.local/share/mise/installs/java/25.0.1', source: 'mise' },
  ]),
}))

vi.mock('../src/inventory/validate-candidates.js', () => ({
  validateCandidates: vi.fn(async (homes: Array<string | { home: string; source: string }>) =>
    homes.map((home, index) => {
      const actualHome = typeof home === 'string' ? home : home.home
      const source = typeof home === 'string' ? 'manual' : home.source

      return {
        major: [17, 21, 25][index] ?? 17,
        fullVersion: `${[17, 21, 25][index] ?? 17}.0.0`,
        javaHome: actualHome,
        javaBin: `${actualHome}/bin/java`,
        javacBin: `${actualHome}/bin/javac`,
        vendor: 'Temurin',
        source,
        validated: true,
        arch: 'arm64',
      }
    }),
  ),
}))

vi.mock('../src/project/find-project-root.js', () => ({
  findProjectRoot: vi.fn(async (cwd: string) => (cwd === '/tmp/not-a-project' ? null : '/workspace/project')),
}))

vi.mock('../src/signals/read-version-files.js', () => ({
  readVersionFiles: vi.fn(async () => []),
}))

vi.mock('../src/signals/read-pom-signals.js', () => ({
  readPomSignals: vi.fn(async () => []),
}))

import { discoverInventory, resolveJdk } from '../src/index.js'

describe('Task 5 compliance', () => {
  it('reports installed majors on NO_PROJECT even without injected inventory', async () => {
    const result = await resolveJdk({
      cwd: '/tmp/not-a-project',
      command: 'mvn test',
      platform: 'darwin',
      env: {},
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('NO_PROJECT')
      expect(result.installedJdkMajors).toEqual([17, 21, 25])
      expect(result.sourcesExamined).toEqual([])
    }
  })

  it('preserves manager source buckets in discovered inventory', async () => {
    const inventory = await discoverInventory('darwin', {})

    expect(inventory.map((candidate) => candidate.source)).toEqual(['sdkman', 'asdf', 'mise'])
  })
})
