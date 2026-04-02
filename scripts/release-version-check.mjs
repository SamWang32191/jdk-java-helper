import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const packageSpecs = [
  { name: '@jdk-auto-switch/core', path: 'packages/core/package.json', publishable: true },
  { name: '@jdk-auto-switch/opencode-plugin', path: 'packages/opencode-plugin/package.json', publishable: true },
  { name: '@jdk-auto-switch/claude-plugin', path: 'packages/claude-plugin/package.json', publishable: false },
]

const readPackageJson = (relativePath) =>
  JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'))

const packages = packageSpecs.map((spec) => ({
  ...spec,
  manifest: readPackageJson(spec.path),
}))

const versions = new Set(packages.map((pkg) => pkg.manifest.version))
if (versions.size !== 1) {
  throw new Error(`Workspace packages must stay in lockstep. Found versions: ${[...versions].join(', ')}`)
}

const coreVersion = packages.find((pkg) => pkg.name === '@jdk-auto-switch/core')?.manifest.version
if (!coreVersion) {
  throw new Error('Missing @jdk-auto-switch/core version')
}

for (const pkg of packages) {
  if (pkg.name === '@jdk-auto-switch/core') {
    continue
  }

  const declaredCoreVersion = pkg.manifest.dependencies?.['@jdk-auto-switch/core']
  if (declaredCoreVersion !== coreVersion) {
    throw new Error(
      `${pkg.name} must depend on @jdk-auto-switch/core@${coreVersion}, found ${declaredCoreVersion ?? 'none'}`,
    )
  }
}

for (const pkg of packages.filter((pkg) => pkg.publishable)) {
  if (pkg.manifest.private === true) {
    throw new Error(`${pkg.name} is marked private and cannot be published`)
  }

  if (pkg.manifest.publishConfig?.access !== 'public') {
    throw new Error(`${pkg.name} must declare publishConfig.access = public`)
  }
}

const gatedPackages = packages.filter((pkg) => !pkg.publishable)
for (const pkg of gatedPackages) {
  if (pkg.manifest.private !== true) {
    throw new Error(`${pkg.name} must stay package-private until its npm contract is complete`)
  }
}

console.log(`Release versions OK (${coreVersion})`)
