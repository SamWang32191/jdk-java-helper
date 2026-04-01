import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readPomSignals } from '../src/signals/read-pom-signals.js'

describe('readPomSignals', () => {
  const fixturesDir = path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures')

  it('reads compiler release from a simple pom', async () => {
    const projectRoot = path.join(fixturesDir, 'simple-pom')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven.compiler.release',
    })
  })

  it('reads compiler source and target from a simple pom', async () => {
    const projectRoot = path.join(fixturesDir, 'simple-pom')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'maven.compiler.source',
    })

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'maven.compiler.target',
    })
  })

  it('reads compiler plugin config from a simple pom', async () => {
    const projectRoot = path.join(fixturesDir, 'simple-pom')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:release',
    })

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'maven-compiler-plugin:source',
    })

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'maven-compiler-plugin:target',
    })

    expect(result).toHaveLength(6)
  })

  it('reads a local parent property', async () => {
    const projectRoot = path.join(fixturesDir, 'multi-module')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'parent:maven.compiler.release',
    })
  })

  it('reads local parent source target and plugin config', async () => {
    const projectRoot = path.join(fixturesDir, 'multi-module')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 11,
      source: 'maven',
      detail: 'parent:maven.compiler.source',
    })

    expect(result).toContainEqual({
      major: 11,
      source: 'maven',
      detail: 'parent:maven.compiler.target',
    })

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'parent:maven-compiler-plugin:release',
    })

    expect(result).toContainEqual({
      major: 11,
      source: 'maven',
      detail: 'parent:maven-compiler-plugin:source',
    })

    expect(result).toContainEqual({
      major: 11,
      source: 'maven',
      detail: 'parent:maven-compiler-plugin:target',
    })

    expect(result).toHaveLength(6)
  })

  it('falls back to Maven default parent relativePath when omitted', async () => {
    const projectRoot = path.join(fixturesDir, 'default-parent', 'child')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 19,
      source: 'maven',
      detail: 'parent:maven.compiler.release',
    })

    expect(result).toContainEqual({
      major: 19,
      source: 'maven',
      detail: 'parent:maven-compiler-plugin:release',
    })
  })

  it('does not read ../pom.xml when no parent is declared', async () => {
    const projectRoot = path.join(fixturesDir, 'no-parent-with-upstream-pom', 'child')
    const result = await readPomSignals(projectRoot)

    expect(result).toEqual([])
  })

  it('resolves same-file and chained property interpolation for supported fields', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-pom')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven.compiler.release',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven.compiler.source',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven.compiler.target',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:release',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:source',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:target',
    })
  })

  it('resolves child plugin configuration from local parent properties', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-parent', 'child')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:source',
    })

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:target',
    })
  })

  it('resolves default-parent property interpolation when relativePath is omitted', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-default-parent', 'child')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 19,
      source: 'maven',
      detail: 'maven-compiler-plugin:release',
    })
  })

  it('ignores unresolved property references', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-unresolved-all')
    const result = await readPomSignals(projectRoot)

    expect(result).toEqual([])
  })

  it('ignores cyclic property references without hanging', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-cycle')
    const result = await readPomSignals(projectRoot)

    expect(result).toEqual([])
  })

  it('keeps valid supported fields when another interpolated field is unresolved', async () => {
    const projectRoot = path.join(fixturesDir, 'interpolated-unresolved')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven-compiler-plugin:target',
    })
    expect(result).toHaveLength(1)
  })
})
