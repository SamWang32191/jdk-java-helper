import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/signals/parse-command-signals.js', () => ({
  parseCommandSignals: vi.fn(() => []),
}))

vi.mock('../src/signals/read-version-files.js', () => ({
  readVersionFiles: vi.fn(async () => [
    { major: 21, source: 'version-file', detail: '.java-version' },
  ]),
}))

vi.mock('../src/signals/read-pom-signals.js', () => ({
  readPomSignals: vi.fn(async () => {
    throw new Error('readPomSignals should not be called when version file resolves')
  }),
}))

import { resolveJdk } from '../src/index.js'

describe('resolveJdk version-file short-circuit', () => {
  it('does not read pom signals when version file resolves', async () => {
    const projectRoot = path.resolve('packages/core/tests/fixtures/simple-pom')

    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'mvn test',
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
      expect(result.diagnostics.examinedSources).toEqual(['command', 'version-file'])
      expect(result.diagnostics.usedSources).toEqual(['version-file'])
    }
  })
})
