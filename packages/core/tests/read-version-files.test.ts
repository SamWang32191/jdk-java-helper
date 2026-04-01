import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import { readVersionFiles } from '../src/signals/read-version-files.js'

describe('readVersionFiles', () => {
  const fixtureDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'version-files')
  const java8FixtureDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'version-files-java8')
  const java8VendorFixtureDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'version-files-java8-vendor')
  const vendorPrefixFixtureDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', 'version-files-openjdk64')

  it('reads .java-version', async () => {
    const result = await readVersionFiles(fixtureDir)
    expect(result).toContainEqual({ major: 17, source: 'version-file', detail: '.java-version' })
  })

  it('reads .tool-versions', async () => {
    const result = await readVersionFiles(fixtureDir)
    expect(result).toContainEqual({ major: 21, source: 'version-file', detail: '.tool-versions' })
  })

  it('reads .sdkmanrc', async () => {
    const result = await readVersionFiles(fixtureDir)
    expect(result).toContainEqual({ major: 25, source: 'version-file', detail: '.sdkmanrc' })
  })

  it('reads java 8 style .java-version', async () => {
    const result = await readVersionFiles(java8FixtureDir)
    expect(result).toContainEqual({ major: 8, source: 'version-file', detail: '.java-version' })
  })

  it('reads java 8 vendor style .tool-versions', async () => {
    const result = await readVersionFiles(java8VendorFixtureDir)
    expect(result).toContainEqual({ major: 8, source: 'version-file', detail: '.tool-versions' })
  })

  it('reads vendor-prefixed .tool-versions', async () => {
    const result = await readVersionFiles(vendorPrefixFixtureDir)
    expect(result).toContainEqual({ major: 17, source: 'version-file', detail: '.tool-versions' })
  })

  it('rethrows non-ENOENT read errors', async () => {
    const spy = vi.spyOn(fs.promises, 'readFile').mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 'EACCES' }))

    await expect(readVersionFiles(fixtureDir)).rejects.toMatchObject({ code: 'EACCES' })

    spy.mockRestore()
  })
})
