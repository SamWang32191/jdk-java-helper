import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type PublishablePackageJson = {
  name?: string
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

const readText = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

describe('npm publish contract', () => {
  it('keeps package docs aligned with scoped package names', () => {
    const rootReadme = readText('../../../README.md')
    const coreReadme = readText('../README.md')
    const opencodeReadme = readText('../../opencode-plugin/README.md')
    const spec = readText('../../../openspec/specs/workspace-package-publishing/spec.md')

    expect(rootReadme).toContain('@w32191/jdk-auto-switch-core')
    expect(rootReadme).toContain('@w32191/jdk-auto-switch-opencode-plugin')
    expect(rootReadme).toContain('@w32191/jdk-auto-switch-claude-plugin')
    expect(coreReadme).toContain('@w32191/jdk-auto-switch-core')
    expect(opencodeReadme).toContain('@w32191/jdk-auto-switch-opencode-plugin')
    expect(spec).toContain('@w32191/jdk-auto-switch-core')
    expect(spec).toContain('@w32191/jdk-auto-switch-opencode-plugin')
  })

  it('keeps core publishable metadata complete', () => {
    const pkg = readPackageJson('../../core/package.json')

    expect(pkg.name).toBe('@w32191/jdk-auto-switch-core')
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

    expect(pkg.name).toBe('@w32191/jdk-auto-switch-opencode-plugin')
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

    expect(pkg.name).toBe('@w32191/jdk-auto-switch-claude-plugin')
    expect(pkg.private).toBe(true)
  })

  it('ships a package-local LICENSE file for each public package', () => {
    expect(existsSync(new URL('../../core/LICENSE', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../../opencode-plugin/LICENSE', import.meta.url))).toBe(true)
  })
})
