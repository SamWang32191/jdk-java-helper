import { describe, expect, it } from 'vitest'
import { resolveJdk } from '../src/index.js'
import type { JdkCandidate, ResolveInput, ResolveResult } from '../src/index.js'

describe('public API', () => {
  it('exports core resolver types', async () => {
    const candidate: JdkCandidate = {
      major: 17,
      fullVersion: '17.0.13',
      javaHome: '/jdks/17',
      javaBin: '/jdks/17/bin/java',
      javacBin: '/jdks/17/bin/javac',
      vendor: 'Temurin',
      source: 'manual',
      validated: true,
      arch: 'arm64',
    }

    const input: ResolveInput = {
      cwd: '/workspace/project',
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [candidate],
    }

    expect(typeof resolveJdk).toBe('function')
    void input
    const _resultTypeCheck: ResolveResult | undefined = undefined
    void _resultTypeCheck
  })
})
