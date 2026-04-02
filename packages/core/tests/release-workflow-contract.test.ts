import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type RootPackageJson = {
  scripts?: Record<string, string>
}

type WorkspacePackageJson = {
  name?: string
  version?: string
  dependencies?: Record<string, string>
}

const readJson = <T>(relativePath: string) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T

describe('workspace npm release workflow', () => {
  it('defines root release scripts for validation and ordered publish', () => {
    const pkg = readJson<RootPackageJson>('../../../package.json')

    expect(pkg.scripts?.['pack:check']).toBeDefined()
    expect(pkg.scripts?.['release:version-check']).toBe('node ./scripts/release-version-check.mjs')
    expect(pkg.scripts?.['release:check']).toContain('npm run release:version-check')
    expect(pkg.scripts?.['release:publish']).toBe('node ./scripts/publish-workspaces.mjs')
    expect(pkg.scripts?.['release:publish:dry-run']).toBe('node ./scripts/publish-workspaces.mjs --dry-run')
  })

  it('keeps internal workspace package versions in lockstep', () => {
    const corePkg = readJson<WorkspacePackageJson>('../../core/package.json')
    const opencodePkg = readJson<WorkspacePackageJson>('../../opencode-plugin/package.json')
    const claudePkg = readJson<WorkspacePackageJson>('../../claude-plugin/package.json')

    expect(corePkg.name).toBe('@w32191/jdk-auto-switch-core')
    expect(opencodePkg.name).toBe('@w32191/jdk-auto-switch-opencode-plugin')
    expect(claudePkg.name).toBe('@w32191/jdk-auto-switch-claude-plugin')
    expect(opencodePkg.version).toBe(corePkg.version)
    expect(claudePkg.version).toBe(corePkg.version)
    expect(opencodePkg.dependencies?.['@w32191/jdk-auto-switch-core']).toBe(corePkg.version)
    expect(claudePkg.dependencies?.['@w32191/jdk-auto-switch-core']).toBe(corePkg.version)
  })
})
