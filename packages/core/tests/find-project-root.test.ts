import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { findProjectRoot } from '../src/project/find-project-root.js'

describe('findProjectRoot', () => {
  it('walks upward to find the nearest pom.xml', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jdk-auto-switch-root-'))
    const nested = path.join(root, 'module', 'src')
    await fs.mkdir(nested, { recursive: true })
    await fs.writeFile(path.join(root, 'pom.xml'), '<project />')

    await expect(findProjectRoot(nested)).resolves.toBe(root)
  })

  it('returns null when no pom.xml exists', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jdk-auto-switch-no-pom-'))
    const nested = path.join(root, 'module', 'src')
    await fs.mkdir(nested, { recursive: true })

    await expect(findProjectRoot(nested)).resolves.toBeNull()
  })
})
