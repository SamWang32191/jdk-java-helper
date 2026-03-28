import { describe, expect, it } from 'vitest'
import os from 'node:os'
import path from 'node:path'
import { resolveJdk } from '../src/index.js'

describe('workspace smoke test', () => {
  it('returns NO_PROJECT when cwd is outside a Maven project', async () => {
    const cwd = path.join(os.tmpdir(), 'jdk-auto-switch-smoke-no-project')

    const result = await resolveJdk({
      cwd,
      command: 'mvn test',
      platform: process.platform,
      env: {},
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('NO_PROJECT')
    }
  })
})
