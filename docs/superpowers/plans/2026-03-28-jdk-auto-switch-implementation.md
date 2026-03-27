# JDK Auto Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-intrusion OpenCode plugin and Claude Code plugin that detect explicit Java requirements in Maven projects and inject the matching JDK into AI-executed shell commands before build/test commands run.

**Architecture:** Use an npm workspace with one shared TypeScript core package plus two thin adapters: one OpenCode plugin and one Claude Code hook/plugin package. The core owns project detection, explicit-signal extraction, JDK inventory discovery, candidate selection, explain/doctor diagnostics, and fail-fast error reporting.

**Tech Stack:** Node.js 22+, TypeScript, npm workspaces, Vitest, fast-xml-parser, tsup

---

## Planned File Structure

### Workspace root
- Create: `package.json` — npm workspace root, shared scripts
- Create: `tsconfig.base.json` — shared TypeScript config
- Create: `vitest.config.ts` — shared test config
- Create: `README.md` — repo usage and development notes

### Shared core package
- Create: `packages/core/package.json` — core package manifest
- Create: `packages/core/tsconfig.json` — package TS config
- Create: `packages/core/src/types.ts` — domain models and result types
- Create: `packages/core/src/project/find-project-root.ts` — Maven root detection
- Create: `packages/core/src/signals/parse-command-signals.ts` — explicit command override parsing
- Create: `packages/core/src/signals/read-version-files.ts` — `.java-version`, `.tool-versions`, `.sdkmanrc`
- Create: `packages/core/src/signals/read-pom-signals.ts` — static Maven parsing
- Create: `packages/core/src/inventory/discover-macos.ts` — macOS inventory provider
- Create: `packages/core/src/inventory/discover-windows.ts` — Windows inventory provider
- Create: `packages/core/src/inventory/discover-managers.ts` — SDKMAN/asdf/mise paths
- Create: `packages/core/src/inventory/validate-candidates.ts` — `java -version` validation
- Create: `packages/core/src/resolver/resolve-jdk.ts` — end-to-end resolver
- Create: `packages/core/src/diagnostics/format-explain.ts` — explain output
- Create: `packages/core/src/diagnostics/format-doctor.ts` — doctor output
- Create: `packages/core/src/index.ts` — package entrypoint

### OpenCode plugin package
- Create: `packages/opencode-plugin/package.json` — plugin package manifest
- Create: `packages/opencode-plugin/src/index.ts` — OpenCode plugin entry
- Create: `packages/opencode-plugin/tests/opencode-plugin.test.ts` — adapter tests

### Claude Code plugin package
- Create: `packages/claude-plugin/package.json` — plugin package manifest
- Create: `packages/claude-plugin/.claude-plugin/plugin.json` — plugin metadata
- Create: `packages/claude-plugin/hooks/hooks.json` — hook registration
- Create: `packages/claude-plugin/scripts/jdk-hook.mjs` — hook adapter entry
- Create: `packages/claude-plugin/tests/claude-hook.test.ts` — adapter tests

### Shared fixtures/tests
- Create: `packages/core/tests/fixtures/simple-pom/pom.xml`
- Create: `packages/core/tests/fixtures/multi-module/pom.xml`
- Create: `packages/core/tests/fixtures/multi-module/parent/pom.xml`
- Create: `packages/core/tests/fixtures/version-files/.java-version`
- Create: `packages/core/tests/fixtures/version-files/.tool-versions`
- Create: `packages/core/tests/fixtures/version-files/.sdkmanrc`
- Create: `packages/core/tests/parse-command-signals.test.ts`
- Create: `packages/core/tests/read-version-files.test.ts`
- Create: `packages/core/tests/read-pom-signals.test.ts`
- Create: `packages/core/tests/resolve-jdk.test.ts`

## Task 1: Bootstrap the npm workspace and core package shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `README.md`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/tests/workspace-smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
// packages/core/tests/workspace-smoke.test.ts
import { describe, expect, it } from 'vitest'
import { resolveJdk } from '../src/index'

describe('workspace smoke test', () => {
  it('returns NO_PROJECT when cwd is outside a Maven project', async () => {
    const result = await resolveJdk({
      cwd: '/tmp/not-a-project',
      command: 'mvn test',
      platform: 'darwin',
      env: {},
    })

    expect(result.kind).toBe('unresolved')
    if (result.kind === 'unresolved') {
      expect(result.code).toBe('NO_PROJECT')
    }
  })
})
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run: `npm test -- --run packages/core/tests/workspace-smoke.test.ts`

Expected: FAIL with module resolution errors because the workspace and `resolveJdk` do not exist yet.

- [ ] **Step 3: Create the workspace manifests and minimal core entry**

```json
// package.json
{
  "name": "jdk-auto-switch",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build -ws",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p packages/core/tsconfig.json --noEmit"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "dist",
    "types": ["node", "vitest/globals"]
  }
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts'],
  },
})
```

```json
// packages/core/package.json
{
  "name": "@jdk-auto-switch/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run"
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

```ts
// packages/core/src/types.ts
export type ResolveCode = 'NO_PROJECT' | 'NO_SIGNAL' | 'CONFLICT' | 'JDK_NOT_FOUND'

export interface ResolveInput {
  cwd: string
  command: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
}

export interface UnresolvedResult {
  kind: 'unresolved'
  code: ResolveCode
  reasons: string[]
}

export type ResolveResult = UnresolvedResult
```

```ts
// packages/core/src/index.ts
import type { ResolveInput, ResolveResult } from './types.js'

export async function resolveJdk(input: ResolveInput): Promise<ResolveResult> {
  void input
  return {
    kind: 'unresolved',
    code: 'NO_PROJECT',
    reasons: ['No pom.xml found in current working directory hierarchy.'],
  }
}
```

```md
// README.md
# jdk-auto-switch

Shared core plus OpenCode and Claude Code adapters for command-scoped JDK switching in Maven projects.
```

- [ ] **Step 4: Run the smoke test and verify it passes**

Run: `npm test -- --run packages/core/tests/workspace-smoke.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit the workspace bootstrap**

```bash
git add package.json tsconfig.base.json vitest.config.ts README.md packages/core
git commit -m "chore: bootstrap workspace and core package"
```

## Task 2: Parse explicit command overrides and repo version files

**Files:**
- Create: `packages/core/src/signals/parse-command-signals.ts`
- Create: `packages/core/src/signals/read-version-files.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/tests/parse-command-signals.test.ts`
- Test: `packages/core/tests/read-version-files.test.ts`
- Create: `packages/core/tests/fixtures/version-files/.java-version`
- Create: `packages/core/tests/fixtures/version-files/.tool-versions`
- Create: `packages/core/tests/fixtures/version-files/.sdkmanrc`

- [ ] **Step 1: Write the failing tests for command overrides and version files**

```ts
// packages/core/tests/parse-command-signals.test.ts
import { describe, expect, it } from 'vitest'
import { parseCommandSignals } from '../src/signals/parse-command-signals.js'

describe('parseCommandSignals', () => {
  it('reads make JAVA override', () => {
    expect(parseCommandSignals('make JAVA=17 test')).toEqual([
      { major: 17, source: 'command', detail: 'make JAVA=17' },
    ])
  })

  it('reads maven property override', () => {
    expect(parseCommandSignals('mvn -Djava.version=21 test')).toEqual([
      { major: 21, source: 'command', detail: '-Djava.version=21' },
    ])
  })
})
```

```ts
// packages/core/tests/read-version-files.test.ts
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { readVersionFiles } from '../src/signals/read-version-files.js'

describe('readVersionFiles', () => {
  const fixtureDir = path.resolve('packages/core/tests/fixtures/version-files')

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
})
```

```text
// packages/core/tests/fixtures/version-files/.java-version
17
```

```text
// packages/core/tests/fixtures/version-files/.tool-versions
java 21.0.7-tem
```

```text
// packages/core/tests/fixtures/version-files/.sdkmanrc
java=25-tem
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- --run packages/core/tests/parse-command-signals.test.ts packages/core/tests/read-version-files.test.ts`

Expected: FAIL because `parseCommandSignals` and `readVersionFiles` do not exist.

- [ ] **Step 3: Implement the signal types and parsers**

```ts
// packages/core/src/types.ts
export type SignalSource = 'command' | 'version-file' | 'maven'

export interface VersionSignal {
  major: number
  source: SignalSource
  detail: string
}

export type ResolveCode = 'NO_PROJECT' | 'NO_SIGNAL' | 'CONFLICT' | 'JDK_NOT_FOUND'

export interface ResolveInput {
  cwd: string
  command: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
}

export interface UnresolvedResult {
  kind: 'unresolved'
  code: ResolveCode
  reasons: string[]
}

export type ResolveResult = UnresolvedResult
```

```ts
// packages/core/src/signals/parse-command-signals.ts
import type { VersionSignal } from '../types.js'

function parseMajor(value: string): number | null {
  const match = value.match(/(\d{1,2})/)
  return match ? Number(match[1]) : null
}

export function parseCommandSignals(command: string): VersionSignal[] {
  const signals: VersionSignal[] = []

  const makeJava = command.match(/(?:^|\s)JAVA=(\d{1,2})(?:\s|$)/)
  if (makeJava) {
    signals.push({ major: Number(makeJava[1]), source: 'command', detail: `make JAVA=${makeJava[1]}` })
  }

  const propertyPatterns = ['java.version', 'maven.compiler.release']
  for (const propertyName of propertyPatterns) {
    const regex = new RegExp(`-D${propertyName.replace('.', '\\.') }=(\\d{1,2})`, 'g')
    for (const match of command.matchAll(regex)) {
      signals.push({
        major: Number(match[1]),
        source: 'command',
        detail: `-D${propertyName}=${match[1]}`,
      })
    }
  }

  const explicitJavaHome = command.match(/JAVA_HOME=([^\s]+)/)
  if (explicitJavaHome) {
    const major = parseMajor(explicitJavaHome[1])
    if (major !== null) {
      signals.push({ major, source: 'command', detail: `JAVA_HOME=${explicitJavaHome[1]}` })
    }
  }

  return signals
}
```

```ts
// packages/core/src/signals/read-version-files.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { VersionSignal } from '../types.js'

function extractMajor(value: string): number | null {
  const match = value.match(/(\d{1,2})/)
  return match ? Number(match[1]) : null
}

export async function readVersionFiles(projectRoot: string): Promise<VersionSignal[]> {
  const signals: VersionSignal[] = []

  const javaVersionPath = path.join(projectRoot, '.java-version')
  const toolVersionsPath = path.join(projectRoot, '.tool-versions')
  const sdkmanrcPath = path.join(projectRoot, '.sdkmanrc')

  try {
    const contents = await fs.readFile(javaVersionPath, 'utf8')
    const major = extractMajor(contents.trim())
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.java-version' })
    }
  } catch {}

  try {
    const contents = await fs.readFile(toolVersionsPath, 'utf8')
    const javaLine = contents
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('java '))
    const major = javaLine ? extractMajor(javaLine) : null
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.tool-versions' })
    }
  } catch {}

  try {
    const contents = await fs.readFile(sdkmanrcPath, 'utf8')
    const javaLine = contents
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('java='))
    const major = javaLine ? extractMajor(javaLine) : null
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.sdkmanrc' })
    }
  } catch {}

  return signals
}
```

```ts
// packages/core/src/index.ts
export { parseCommandSignals } from './signals/parse-command-signals.js'
export { readVersionFiles } from './signals/read-version-files.js'
```

- [ ] **Step 4: Run the parser tests and verify they pass**

Run: `npm test -- --run packages/core/tests/parse-command-signals.test.ts packages/core/tests/read-version-files.test.ts`

Expected: PASS with 5 tests passed.

- [ ] **Step 5: Commit the explicit-signal parsers**

```bash
git add packages/core/src/signals packages/core/src/types.ts packages/core/src/index.ts packages/core/tests
git commit -m "feat: parse command and repo version signals"
```

## Task 3: Parse Maven signals statically from pom.xml and local parent pom files

**Files:**
- Create: `packages/core/src/signals/read-pom-signals.ts`
- Modify: `packages/core/package.json`
- Test: `packages/core/tests/read-pom-signals.test.ts`
- Create: `packages/core/tests/fixtures/simple-pom/pom.xml`
- Create: `packages/core/tests/fixtures/multi-module/pom.xml`
- Create: `packages/core/tests/fixtures/multi-module/parent/pom.xml`

- [ ] **Step 1: Write the failing tests for static Maven parsing**

```ts
// packages/core/tests/read-pom-signals.test.ts
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { readPomSignals } from '../src/signals/read-pom-signals.js'

describe('readPomSignals', () => {
  it('reads compiler release from a simple pom', async () => {
    const projectRoot = path.resolve('packages/core/tests/fixtures/simple-pom')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 21,
      source: 'maven',
      detail: 'maven.compiler.release',
    })
  })

  it('reads a local parent property', async () => {
    const projectRoot = path.resolve('packages/core/tests/fixtures/multi-module')
    const result = await readPomSignals(projectRoot)

    expect(result).toContainEqual({
      major: 17,
      source: 'maven',
      detail: 'parent:maven.compiler.release',
    })
  })
})
```

```xml
<!-- packages/core/tests/fixtures/simple-pom/pom.xml -->
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>dev.demo</groupId>
  <artifactId>simple</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
</project>
```

```xml
<!-- packages/core/tests/fixtures/multi-module/parent/pom.xml -->
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>dev.demo</groupId>
  <artifactId>parent</artifactId>
  <version>1.0.0</version>
  <properties>
    <maven.compiler.release>17</maven.compiler.release>
  </properties>
</project>
```

```xml
<!-- packages/core/tests/fixtures/multi-module/pom.xml -->
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>dev.demo</groupId>
    <artifactId>parent</artifactId>
    <version>1.0.0</version>
    <relativePath>parent/pom.xml</relativePath>
  </parent>
  <artifactId>child</artifactId>
  <version>1.0.0</version>
</project>
```

- [ ] **Step 2: Run the Maven parser tests and verify they fail**

Run: `npm test -- --run packages/core/tests/read-pom-signals.test.ts`

Expected: FAIL because `readPomSignals` and XML parsing dependencies do not exist.

- [ ] **Step 3: Add XML parsing dependency and implement static Maven parsing**

```json
// packages/core/package.json
{
  "name": "@jdk-auto-switch/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run"
  },
  "dependencies": {
    "fast-xml-parser": "^5.0.0"
  }
}
```

```ts
// packages/core/src/signals/read-pom-signals.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type { VersionSignal } from '../types.js'

const parser = new XMLParser({ ignoreAttributes: false })

function parseMajor(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/(\d{1,2})/)
  return match ? Number(match[1]) : null
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

async function readPomObject(pomPath: string): Promise<any> {
  const xml = await fs.readFile(pomPath, 'utf8')
  return parser.parse(xml).project
}

export async function readPomSignals(projectRoot: string): Promise<VersionSignal[]> {
  const pomPath = path.join(projectRoot, 'pom.xml')
  const project = await readPomObject(pomPath)
  const signals: VersionSignal[] = []

  const properties = project.properties ?? {}
  for (const [propertyName, detail] of [
    ['maven.compiler.release', 'maven.compiler.release'],
    ['maven.compiler.source', 'maven.compiler.source'],
    ['maven.compiler.target', 'maven.compiler.target'],
  ] as const) {
    const major = parseMajor(properties[propertyName])
    if (major !== null) {
      signals.push({ major, source: 'maven', detail })
    }
  }

  const plugins = asArray(project.build?.plugins?.plugin)
  for (const plugin of plugins) {
    if (plugin.artifactId !== 'maven-compiler-plugin') continue
    const major = parseMajor(plugin.configuration?.release ?? plugin.configuration?.source)
    if (major !== null) {
      signals.push({ major, source: 'maven', detail: 'maven-compiler-plugin' })
    }
  }

  const parentRelativePath = project.parent?.relativePath
  if (typeof parentRelativePath === 'string' && parentRelativePath.length > 0) {
    const parentPom = await readPomObject(path.resolve(projectRoot, parentRelativePath))
    const parentRelease = parseMajor(parentPom.properties?.['maven.compiler.release'])
    if (parentRelease !== null) {
      signals.push({ major: parentRelease, source: 'maven', detail: 'parent:maven.compiler.release' })
    }
  }

  return signals
}
```

- [ ] **Step 4: Run the Maven parser tests and verify they pass**

Run: `npm test -- --run packages/core/tests/read-pom-signals.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit the Maven parser**

```bash
git add packages/core/package.json packages/core/src/signals/read-pom-signals.ts packages/core/tests
git commit -m "feat: add static maven signal parsing"
```

## Task 4: Discover and validate installed JDK candidates on macOS and Windows

**Files:**
- Create: `packages/core/src/inventory/discover-macos.ts`
- Create: `packages/core/src/inventory/discover-windows.ts`
- Create: `packages/core/src/inventory/discover-managers.ts`
- Create: `packages/core/src/inventory/validate-candidates.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/tests/discover-candidates.test.ts`

- [ ] **Step 1: Write the failing inventory tests**

```ts
// packages/core/tests/discover-candidates.test.ts
import { describe, expect, it } from 'vitest'
import { normalizeCandidate } from '../src/inventory/validate-candidates.js'

describe('normalizeCandidate', () => {
  it('extracts a major version from a java -version output', () => {
    const result = normalizeCandidate('/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home', 'openjdk version "21.0.7" 2025-04-15')

    expect(result.major).toBe(21)
    expect(result.javaHome).toContain('temurin-21')
  })
})
```

- [ ] **Step 2: Run the inventory tests and verify they fail**

Run: `npm test -- --run packages/core/tests/discover-candidates.test.ts`

Expected: FAIL because inventory modules do not exist.

- [ ] **Step 3: Implement candidate discovery and validation helpers**

```ts
// packages/core/src/types.ts
export interface JdkCandidate {
  major: number
  fullVersion: string
  javaHome: string
  javaBin: string
  javacBin: string
  vendor: string
  source: string
  validated: boolean
}
```

```ts
// packages/core/src/inventory/validate-candidates.ts
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import path from 'node:path'
import type { JdkCandidate } from '../types.js'

const execFileAsync = promisify(execFile)

export function normalizeCandidate(javaHome: string, versionOutput: string, source = 'manual'): JdkCandidate {
  const majorMatch = versionOutput.match(/"(\d{1,2})(?:\.|")/)
  const fullVersionMatch = versionOutput.match(/"([^"]+)"/)

  if (!majorMatch || !fullVersionMatch) {
    throw new Error(`Unable to parse java version output: ${versionOutput}`)
  }

  return {
    major: Number(majorMatch[1]),
    fullVersion: fullVersionMatch[1],
    javaHome,
    javaBin: path.join(javaHome, 'bin', 'java'),
    javacBin: path.join(javaHome, 'bin', 'javac'),
    vendor: versionOutput.includes('Temurin') ? 'Temurin' : 'Unknown',
    source,
    validated: true,
  }
}

export async function validateHome(javaHome: string, source = 'manual'): Promise<JdkCandidate> {
  const javaBin = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  const { stdout, stderr } = await execFileAsync(javaBin, ['-version'])
  return normalizeCandidate(javaHome, `${stdout}\n${stderr}`.trim(), source)
}
```

```ts
// packages/core/src/inventory/discover-macos.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function discoverMacosHomes(): Promise<string[]> {
  const root = '/Library/Java/JavaVirtualMachines'
  try {
    const entries = await fs.readdir(root)
    return entries.map((entry) => path.join(root, entry, 'Contents', 'Home'))
  } catch {
    return []
  }
}
```

```ts
// packages/core/src/inventory/discover-windows.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'

const roots = [
  'C:/Program Files/Java',
  'C:/Program Files/Eclipse Adoptium',
  'C:/Program Files/Microsoft',
]

export async function discoverWindowsHomes(): Promise<string[]> {
  const results: string[] = []
  for (const root of roots) {
    try {
      const entries = await fs.readdir(root)
      for (const entry of entries) {
        results.push(path.join(root, entry))
      }
    } catch {}
  }
  return results
}
```

```ts
// packages/core/src/inventory/discover-managers.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'

async function readChildHomes(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root)
    return entries.map((entry) => path.join(root, entry))
  } catch {
    return []
  }
}

export async function discoverManagerHomes(homeDir: string): Promise<string[]> {
  const sdkman = await readChildHomes(path.join(homeDir, '.sdkman', 'candidates', 'java'))
  const asdf = await readChildHomes(path.join(homeDir, '.asdf', 'installs', 'java'))
  const mise = await readChildHomes(path.join(homeDir, '.local', 'share', 'mise', 'installs', 'java'))
  return [...sdkman, ...asdf, ...mise]
}
```

- [ ] **Step 4: Run the inventory tests and verify they pass**

Run: `npm test -- --run packages/core/tests/discover-candidates.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit the inventory discovery layer**

```bash
git add packages/core/src/inventory packages/core/src/types.ts packages/core/tests/discover-candidates.test.ts
git commit -m "feat: discover and normalize local jdk candidates"
```

## Task 5: Implement the end-to-end resolver plus explain and doctor diagnostics

**Files:**
- Create: `packages/core/src/project/find-project-root.ts`
- Create: `packages/core/src/resolver/resolve-jdk.ts`
- Create: `packages/core/src/diagnostics/format-explain.ts`
- Create: `packages/core/src/diagnostics/format-doctor.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/types.ts`
- Test: `packages/core/tests/resolve-jdk.test.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
// packages/core/tests/resolve-jdk.test.ts
import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { resolveJdk } from '../src/resolver/resolve-jdk.js'

describe('resolveJdk', () => {
  it('prefers exact command override over pom release', async () => {
    const projectRoot = path.resolve('packages/core/tests/fixtures/simple-pom')
    const result = await resolveJdk({
      cwd: projectRoot,
      command: 'make JAVA=17 test',
      platform: 'darwin',
      env: {},
      inventory: [
        { major: 17, fullVersion: '17.0.13', javaHome: '/jdks/17', javaBin: '/jdks/17/bin/java', javacBin: '/jdks/17/bin/javac', vendor: 'Temurin', source: 'manual', validated: true },
        { major: 21, fullVersion: '21.0.7', javaHome: '/jdks/21', javaBin: '/jdks/21/bin/java', javacBin: '/jdks/21/bin/javac', vendor: 'Temurin', source: 'manual', validated: true },
      ],
    })

    expect(result.kind).toBe('resolved')
    if (result.kind === 'resolved') {
      expect(result.major).toBe(17)
      expect(result.env.JAVA_HOME).toBe('/jdks/17')
    }
  })
})
```

- [ ] **Step 2: Run the resolver test and verify it fails**

Run: `npm test -- --run packages/core/tests/resolve-jdk.test.ts`

Expected: FAIL because resolver internals do not exist.

- [ ] **Step 3: Implement project detection, resolution, and diagnostics**

```ts
// packages/core/src/project/find-project-root.ts
import { promises as fs } from 'node:fs'
import path from 'node:path'

export async function findProjectRoot(cwd: string): Promise<string | null> {
  let current = path.resolve(cwd)

  while (true) {
    try {
      await fs.access(path.join(current, 'pom.xml'))
      return current
    } catch {}

    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}
```

```ts
// packages/core/src/types.ts
export interface ResolvedResult {
  kind: 'resolved'
  major: number
  env: Record<string, string>
  reasons: string[]
}

export interface ResolveInput {
  cwd: string
  command: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  inventory?: JdkCandidate[]
}

export interface UnresolvedResult {
  kind: 'unresolved'
  code: ResolveCode
  reasons: string[]
}

export type ResolveResult = ResolvedResult | UnresolvedResult
```

```ts
// packages/core/src/resolver/resolve-jdk.ts
import path from 'node:path'
import { discoverMacosHomes } from '../inventory/discover-macos.js'
import { discoverWindowsHomes } from '../inventory/discover-windows.js'
import { discoverManagerHomes } from '../inventory/discover-managers.js'
import { validateHome } from '../inventory/validate-candidates.js'
import { findProjectRoot } from '../project/find-project-root.js'
import { parseCommandSignals } from '../signals/parse-command-signals.js'
import { readPomSignals } from '../signals/read-pom-signals.js'
import { readVersionFiles } from '../signals/read-version-files.js'
import type { JdkCandidate, ResolveInput, ResolveResult, VersionSignal } from '../types.js'

function pickSignals(commandSignals: VersionSignal[], repoSignals: VersionSignal[], pomSignals: VersionSignal[]): VersionSignal[] {
  if (commandSignals.length > 0) return commandSignals
  if (repoSignals.length > 0) return repoSignals
  return pomSignals
}

function detectConflict(signals: VersionSignal[]): boolean {
  return new Set(signals.map((signal) => signal.major)).size > 1
}

function buildEnv(candidate: JdkCandidate, env: NodeJS.ProcessEnv): Record<string, string> {
  const binDir = candidate.javaBin.replace(/[/\\]java(?:\.exe)?$/, '')
  return {
    ...env,
    JAVA_HOME: candidate.javaHome,
    PATH: `${binDir}${path.delimiter}${env.PATH ?? ''}`,
  }
}

export async function resolveJdk(input: ResolveInput): Promise<ResolveResult> {
  const projectRoot = await findProjectRoot(input.cwd)
  if (!projectRoot) {
    return { kind: 'unresolved', code: 'NO_PROJECT', reasons: ['No pom.xml found.'] }
  }

  const commandSignals = parseCommandSignals(input.command)
  const repoSignals = await readVersionFiles(projectRoot)
  const pomSignals = await readPomSignals(projectRoot)
  const chosenSignals = pickSignals(commandSignals, repoSignals, pomSignals)

  if (chosenSignals.length === 0) {
    return { kind: 'unresolved', code: 'NO_SIGNAL', reasons: ['No explicit Java signal found.'] }
  }

  if (detectConflict(chosenSignals)) {
    return { kind: 'unresolved', code: 'CONFLICT', reasons: ['Explicit Java signals conflict.'] }
  }

  const requiredMajor = chosenSignals[0].major
  const inventory = input.inventory ?? await discoverInventory(
    input.platform,
    input.env.HOME ?? input.env.USERPROFILE ?? '',
  )
  const candidate = inventory.find((item) => item.major === requiredMajor)

  if (!candidate) {
    return { kind: 'unresolved', code: 'JDK_NOT_FOUND', reasons: [`Missing JDK ${requiredMajor}.`] }
  }

  return {
    kind: 'resolved',
    major: requiredMajor,
    env: buildEnv(candidate, input.env),
    reasons: chosenSignals.map((signal) => `${signal.source}:${signal.detail}`),
  }
}

export async function discoverInventory(platform: NodeJS.Platform, homeDir: string): Promise<JdkCandidate[]> {
  const homes = platform === 'darwin'
    ? await discoverMacosHomes()
    : platform === 'win32'
      ? await discoverWindowsHomes()
      : []

  const managerHomes = await discoverManagerHomes(homeDir)
  const allHomes = [...homes, ...managerHomes]
  const results = await Promise.allSettled(allHomes.map((javaHome) => validateHome(javaHome, 'discovered')))
  return results
    .filter((result): result is PromiseFulfilledResult<JdkCandidate> => result.status === 'fulfilled')
    .map((result) => result.value)
}
```

```ts
// packages/core/src/diagnostics/format-explain.ts
import type { ResolveResult } from '../types.js'

export function formatExplain(result: ResolveResult): string {
  if (result.kind === 'unresolved') {
    return `Resolution failed: ${result.code}\n${result.reasons.join('\n')}`
  }

  return [`Selected Java ${result.major}`, ...result.reasons].join('\n')
}
```

```ts
// packages/core/src/diagnostics/format-doctor.ts
import type { JdkCandidate } from '../types.js'

export function formatDoctor(candidates: JdkCandidate[]): string {
  return candidates
    .map((candidate) => `${candidate.major}\t${candidate.fullVersion}\t${candidate.javaHome}`)
    .join('\n')
}
```

```ts
// packages/core/src/index.ts
export { parseCommandSignals } from './signals/parse-command-signals.js'
export { readVersionFiles } from './signals/read-version-files.js'
export { readPomSignals } from './signals/read-pom-signals.js'
export { resolveJdk, discoverInventory } from './resolver/resolve-jdk.js'
export { formatExplain } from './diagnostics/format-explain.js'
export { formatDoctor } from './diagnostics/format-doctor.js'
```

- [ ] **Step 4: Run the resolver test and verify it passes**

Run: `npm test -- --run packages/core/tests/resolve-jdk.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit the resolver and diagnostics**

```bash
git add packages/core/src/project packages/core/src/resolver packages/core/src/diagnostics packages/core/src/index.ts packages/core/src/types.ts packages/core/tests/resolve-jdk.test.ts
git commit -m "feat: resolve jdk from explicit project signals"
```

## Task 6: Implement the OpenCode adapter package

**Files:**
- Create: `packages/opencode-plugin/package.json`
- Create: `packages/opencode-plugin/src/index.ts`
- Create: `packages/opencode-plugin/tests/opencode-plugin.test.ts`

- [ ] **Step 1: Write the failing adapter test**

```ts
// packages/opencode-plugin/tests/opencode-plugin.test.ts
import { describe, expect, it } from 'vitest'
import { createOpenCodePlugin } from '../src/index.js'

describe('OpenCode plugin', () => {
  it('injects JAVA_HOME into shell.env', async () => {
    const plugin = await createOpenCodePlugin({
      resolve: async () => ({
        kind: 'resolved',
        major: 21,
        env: { JAVA_HOME: '/jdks/21', PATH: '/jdks/21/bin:/usr/bin' },
        reasons: ['maven:maven.compiler.release'],
      }),
    })

    const output = { env: {} as Record<string, string> }
    await plugin['shell.env']({ cwd: '/workspace' }, output)

    expect(output.env.JAVA_HOME).toBe('/jdks/21')
  })
})
```

- [ ] **Step 2: Run the adapter test and verify it fails**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`

Expected: FAIL because the OpenCode adapter package does not exist.

- [ ] **Step 3: Implement the OpenCode plugin**

```json
// packages/opencode-plugin/package.json
{
  "name": "@jdk-auto-switch/opencode-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@jdk-auto-switch/core": "0.1.0"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run"
  }
}
```

```ts
// packages/opencode-plugin/src/index.ts
import { resolveJdk } from '@jdk-auto-switch/core'

interface ResolverLike {
  resolve: typeof resolveJdk
}

export async function createOpenCodePlugin(resolver: ResolverLike = { resolve: resolveJdk }) {
  return {
    async 'shell.env'(input: { cwd: string }, output: { env: Record<string, string> }) {
      const result = await resolver.resolve({ cwd: input.cwd, command: '', platform: process.platform, env: process.env })
      if (result.kind === 'resolved') {
        output.env = { ...output.env, ...result.env }
      }
    },

    async 'tool.execute.before'(
      input: { tool: string },
      output: { args: { command?: string; cwd?: string } },
    ) {
      if (input.tool !== 'bash') return
      const result = await resolver.resolve({
        cwd: output.args.cwd ?? process.cwd(),
        command: output.args.command ?? '',
        platform: process.platform,
        env: process.env,
      })

      if (result.kind === 'unresolved' && result.code !== 'NO_PROJECT') {
        throw new Error(result.reasons.join('\n'))
      }
    },
  }
}
```

- [ ] **Step 4: Run the OpenCode adapter test and verify it passes**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit the OpenCode adapter**

```bash
git add packages/opencode-plugin
git commit -m "feat: add opencode jdk injection plugin"
```

## Task 7: Implement the Claude Code hook/plugin package

**Files:**
- Create: `packages/claude-plugin/package.json`
- Create: `packages/claude-plugin/.claude-plugin/plugin.json`
- Create: `packages/claude-plugin/hooks/hooks.json`
- Create: `packages/claude-plugin/scripts/jdk-hook.mjs`
- Create: `packages/claude-plugin/tests/claude-hook.test.ts`

- [ ] **Step 1: Write the failing Claude hook test**

```ts
// packages/claude-plugin/tests/claude-hook.test.ts
import { describe, expect, it } from 'vitest'
import { runHook } from '../scripts/jdk-hook.mjs'

describe('Claude hook', () => {
  it('writes env exports when resolver returns a JDK', async () => {
    const result = await runHook({
      event: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'mvn test', cwd: '/workspace' },
    }, {
      resolve: async () => ({
        kind: 'resolved',
        major: 25,
        env: { JAVA_HOME: '/jdks/25', PATH: '/jdks/25/bin:/usr/bin' },
        reasons: ['command:-Djava.version=25'],
      }),
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('JAVA_HOME=/jdks/25')
  })
})
```

- [ ] **Step 2: Run the Claude hook test and verify it fails**

Run: `npm test -- --run packages/claude-plugin/tests/claude-hook.test.ts`

Expected: FAIL because the Claude adapter package does not exist.

- [ ] **Step 3: Implement the Claude plugin metadata, hook registration, and hook script**

```json
// packages/claude-plugin/package.json
{
  "name": "@jdk-auto-switch/claude-plugin",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@jdk-auto-switch/core": "0.1.0"
  }
}
```

```json
// packages/claude-plugin/.claude-plugin/plugin.json
{
  "name": "jdk-auto-switch",
  "version": "0.1.0",
  "description": "Injects project-matching JDK env for Bash commands in Maven projects."
}
```

```json
// packages/claude-plugin/hooks/hooks.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/jdk-hook.mjs"
      }
    ],
    "CwdChanged": [
      {
        "command": "node ${CLAUDE_PLUGIN_ROOT}/scripts/jdk-hook.mjs"
      }
    ]
  }
}
```

```js
// packages/claude-plugin/scripts/jdk-hook.mjs
import { readFile } from 'node:fs/promises'
import { resolveJdk } from '@jdk-auto-switch/core'

export async function runHook(payload, resolver = { resolve: resolveJdk }) {
  const event = payload.event
  const cwd = payload.tool_input?.cwd ?? payload.cwd ?? process.cwd()
  const command = payload.tool_input?.command ?? ''
  const result = await resolver.resolve({ cwd, command, platform: process.platform, env: process.env })

  if (result.kind === 'unresolved' && result.code !== 'NO_PROJECT') {
    return { exitCode: 2, stdout: result.reasons.join('\n') }
  }

  if (result.kind === 'resolved') {
    const lines = Object.entries(result.env).map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
    return { exitCode: 0, stdout: lines.join('\n') }
  }

  return { exitCode: 0, stdout: '' }
}

if (process.argv[1] && process.argv[1].endsWith('jdk-hook.mjs')) {
  const raw = await readFile(0, 'utf8')
  const payload = raw.length > 0 ? JSON.parse(raw) : {}
  const result = await runHook(payload)
  process.stdout.write(result.stdout)
  process.exit(result.exitCode)
}
```

- [ ] **Step 4: Run the Claude hook test and verify it passes**

Run: `npm test -- --run packages/claude-plugin/tests/claude-hook.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit the Claude adapter**

```bash
git add packages/claude-plugin
git commit -m "feat: add claude code jdk hook plugin"
```

## Task 8: Add doctor/explain command wiring, top-level docs, and final verification

**Files:**
- Modify: `README.md`
- Create: `packages/core/src/cli.ts`
- Modify: `packages/core/package.json`
- Test: `packages/core/tests/cli.test.ts`

- [ ] **Step 1: Write the failing CLI test**

```ts
// packages/core/tests/cli.test.ts
import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli.js'

describe('runCli', () => {
  it('prints explain output', async () => {
    const output = await runCli(['explain', '--cwd', '/workspace', '--command', 'make JAVA=17 test'], {
      resolve: async () => ({
        kind: 'resolved',
        major: 17,
        env: { JAVA_HOME: '/jdks/17', PATH: '/jdks/17/bin:/usr/bin' },
        reasons: ['command:make JAVA=17'],
      }),
    })

    expect(output).toContain('Selected Java 17')
  })
})
```

- [ ] **Step 2: Run the CLI test and verify it fails**

Run: `npm test -- --run packages/core/tests/cli.test.ts`

Expected: FAIL because the CLI entry does not exist.

- [ ] **Step 3: Implement the CLI entry and update docs**

```ts
// packages/core/src/cli.ts
import { formatExplain } from './diagnostics/format-explain.js'
import { resolveJdk } from './resolver/resolve-jdk.js'

export async function runCli(argv: string[], deps = { resolve: resolveJdk }): Promise<string> {
  const [commandName, , cwd = process.cwd(), , command = ''] = argv
  if (commandName !== 'explain') {
    return 'Usage: jdk-auto-switch explain --cwd <path> --command <shell-command>'
  }

  const result = await deps.resolve({ cwd, command, platform: process.platform, env: process.env })
  return formatExplain(result)
}
```

```json
// packages/core/package.json
{
  "name": "@jdk-auto-switch/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "jdk-auto-switch": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup src/index.ts src/cli.ts --format esm --dts",
    "test": "vitest run"
  },
  "dependencies": {
    "fast-xml-parser": "^5.0.0"
  }
}
```

```md
// README.md
# jdk-auto-switch

## Packages

- `@jdk-auto-switch/core` — resolver, diagnostics, CLI
- `@jdk-auto-switch/opencode-plugin` — OpenCode adapter
- `@jdk-auto-switch/claude-plugin` — Claude Code plugin package

## Development

~~~bash
npm install
npm test
npm run build
~~~

## Example CLI usage

~~~bash
npx jdk-auto-switch explain --cwd /path/to/project --command "make JAVA=17 test"
~~~
```

- [ ] **Step 4: Run the CLI test plus full verification**

Run: `npm test && npm run build`

Expected:
- all Vitest suites PASS
- build emits workspace dist files without TypeScript errors

- [ ] **Step 5: Commit the CLI and docs**

```bash
git add README.md packages/core/src/cli.ts packages/core/package.json packages/core/tests/cli.test.ts
git commit -m "feat: add diagnostics cli and development docs"
```

## Self-Review

### Spec coverage
- OpenCode adapter coverage: Task 6
- Claude Code adapter coverage: Task 7
- Zero-intrusion explicit-signal resolution: Tasks 2, 3, 5
- Wrapper command support through interception: Tasks 2, 5, 6, 7
- Auto-discovered JDK inventory plus validation: Task 4
- Explain/doctor diagnostics and fail-fast behavior: Tasks 5 and 8

### Placeholder scan
- No `TODO`, `TBD`, or deferred implementation text remains inside task steps.
- Every task includes exact file paths, commands, and concrete code.

### Type consistency
- `ResolveInput`, `ResolveResult`, `VersionSignal`, and `JdkCandidate` names are used consistently across tasks.
- `resolveJdk` remains the single shared core entrypoint referenced by both adapters and the CLI.
