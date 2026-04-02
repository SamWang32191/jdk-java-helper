import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type PublishablePackageJson = {
  license?: string
  publishConfig?: { access?: string }
  files?: string[]
  main?: string
  types?: string
  exports?: {
    '.': {
      types?: string
      default?: string
    }
  }
  private?: boolean
}

const readPackageJson = (relativePath: string) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as PublishablePackageJson

describe('npm publish contract', () => {
  it('keeps core publishable metadata complete', () => {
    const pkg = readPackageJson('../../core/package.json')

    expect(pkg.license).toBeDefined()
    expect(pkg.publishConfig?.access).toBe('public')
    expect(pkg.files).toBeDefined()
    expect(pkg.main).toBe('dist/index.js')
    expect(pkg.types).toBe('dist/index.d.ts')
    expect(pkg.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(pkg.exports?.['.'].default).toBe('./dist/index.js')
  })

  it('keeps opencode-plugin publishable metadata complete', () => {
    const pkg = readPackageJson('../../opencode-plugin/package.json')

    expect(pkg.license).toBeDefined()
    expect(pkg.publishConfig?.access).toBe('public')
    expect(pkg.files).toBeDefined()
    expect(pkg.main).toBe('dist/index.js')
    expect(pkg.types).toBe('dist/index.d.ts')
    expect(pkg.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(pkg.exports?.['.'].default).toBe('./dist/index.js')
  })

  it('gates claude-plugin at the package level until it is ready to publish', () => {
    const pkg = readPackageJson('../../claude-plugin/package.json')

    expect(pkg.private).toBe(true)
  })

  it('ships a package-local LICENSE file for each public package', () => {
    expect(existsSync(new URL('../../core/LICENSE', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../../opencode-plugin/LICENSE', import.meta.url))).toBe(true)
  })
})
