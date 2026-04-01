import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/signals/read-version-files.js', () => ({
  readVersionFiles: vi.fn(async () => {
    throw new Error('readVersionFiles should not be called when command override exists')
  }),
}))

vi.mock('../src/signals/read-pom-signals.js', () => ({
  readPomSignals: vi.fn(async () => {
    throw new Error('readPomSignals should not be called when command override exists')
  }),
}))

import { resolveJdk } from '../src/index.js'

describe('resolveJdk short-circuit', () => {
  it('does not read lower-priority sources when command override resolves', async () => {
    const projectRoot = path.resolve('packages/core/tests/fixtures/simple-pom')

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

    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.major).toBe(17)
    }
  })
})
