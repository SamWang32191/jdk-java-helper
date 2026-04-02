# OpenCode npm Plugin MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@jdk-auto-switch/opencode-plugin` loadable by the current OpenCode npm plugin loader, keep the existing Maven JDK hook behavior intact, and verify the package through contract plus runtime-oriented smoke testing.

**Architecture:** Keep `createOpenCodePlugin()` as the internal hook factory, but expose a runtime-facing `server` entry that matches the current `@opencode-ai/plugin` contract and npm loader expectations. Add loader metadata in `package.json`, update tests to target the new entry shape, and add a smoke test that starts OpenCode with a temporary config pointing at a packed local tarball.

**Tech Stack:** TypeScript, Vitest, tsup, npm workspaces, `@opencode-ai/plugin`, OpenCode CLI

---

### Task 1: Rewrite the contract tests around npm plugin loadability

**Files:**
- Modify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`
- Reference: `.opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts`
- Reference: `packages/opencode-plugin/package.json`

- [ ] **Step 1: Write the failing contract tests**

Replace the current default-export-focused assertions with server-target and loader-metadata assertions.

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import pluginModule, { createOpenCodePlugin, server } from '../src/index.js'
import type { ResolveResult } from '@jdk-auto-switch/core'

const opencodePackageJsonUrl = new URL('../package.json', import.meta.url)

describe('OpenCode npm plugin contract', () => {
  it('declares a server plugin target for OpenCode loader discovery', () => {
    const packageJson = JSON.parse(readFileSync(opencodePackageJsonUrl, 'utf8')) as {
      exports?: { '.': { types?: string; default?: string } }
      'oc-plugin'?: string[]
    }

    expect(packageJson.exports?.['.'].types).toBe('./dist/index.d.ts')
    expect(packageJson.exports?.['.'].default).toBe('./dist/index.js')
    expect(packageJson['oc-plugin']).toEqual(['server'])
  })

  it('exports a plugin module with a server entry', () => {
    expect(pluginModule).toMatchObject({ server })
    expect(pluginModule.server).toBeTypeOf('function')
  })

  it('creates OpenCode hooks from the exported server entry', async () => {
    const plugin = await server({
      project: {} as never,
      client: {} as never,
      directory: '/workspace/project',
      worktree: '/workspace/project',
      serverUrl: new URL('http://127.0.0.1:4096'),
      $: {} as never,
    })

    expect(plugin['shell.env']).toBeTypeOf('function')
    expect(plugin['tool.execute.before']).toBeTypeOf('function')
  })
})
```

- [ ] **Step 2: Run the package test file to verify it fails**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: FAIL because `package.json` does not yet declare `"oc-plugin": ["server"]`, and `src/index.ts` does not yet export a plugin module object with `server`.

- [ ] **Step 3: Keep the existing hook behavior tests in place**

Preserve the current hook-level tests below the new contract block so the same file still verifies:

```ts
it('injects JAVA_HOME from resolver env into shell.env hook', async () => {
  const resolveJdk = vi.fn(async () => resolvedResult)
  const plugin = createOpenCodePlugin({
    resolveJdk,
    env: { PATH: '/usr/bin' },
  })

  const output = { env: { PATH: '/usr/bin' } }
  await plugin['shell.env']({ cwd: '/workspace/project' }, output)

  expect(output.env.JAVA_HOME).toBe('/jdks/17')
})
```

Do not change their intent yet; only adjust imports and top-level describe labels if required by the new entry shape.

- [ ] **Step 4: Run the package test file again after only test edits**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: FAIL, but now only because implementation/package metadata are still missing.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-plugin/tests/opencode-plugin.test.ts
git commit -m "test: define opencode npm plugin contract"
```

### Task 2: Export a real `server` entry and add npm loader metadata

**Files:**
- Modify: `packages/opencode-plugin/src/index.ts`
- Modify: `packages/opencode-plugin/package.json`
- Test: `packages/opencode-plugin/tests/opencode-plugin.test.ts`

- [ ] **Step 1: Add the failing metadata and entrypoint expectations to implementation mentally before editing**

The implementation must satisfy all of these at once:

```ts
// runtime contract to satisfy
export const server: Plugin = async (input, options) => {
  return createOpenCodePlugin()
}

const pluginModule: PluginModule = { server }
export default pluginModule
```

And in `package.json`:

```json
{
  "oc-plugin": ["server"]
}
```

- [ ] **Step 2: Update `src/index.ts` with the new runtime-facing entrypoint**

Apply these edits near the top and bottom of the file.

```ts
import type { Plugin, PluginModule } from '@opencode-ai/plugin'
import type { ResolveInput, ResolveResult } from '@jdk-auto-switch/core'

export function createOpenCodePlugin(
  dependencies: OpenCodePluginDependencies = {},
): OpenCodeHooks {
  // existing implementation stays intact
}

export const server: Plugin = async (_input, _options) => {
  return createOpenCodePlugin()
}

const pluginModule: PluginModule = {
  server,
}

export default pluginModule
```

Delete the old `OpenCodePluginOptions` alias and the old `opencodePlugin()` default-export function once `server` replaces it.

- [ ] **Step 3: Update `package.json` for loader discovery and type availability**

Make `packages/opencode-plugin/package.json` look like this.

```json
{
  "name": "@jdk-auto-switch/opencode-plugin",
  "version": "0.1.0",
  "type": "module",
  "oc-plugin": ["server"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --tsconfig tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@jdk-auto-switch/core": "0.1.0",
    "@opencode-ai/plugin": "1.3.13"
  }
}
```

- [ ] **Step 4: Run the contract/unit test file to verify it passes**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: PASS

- [ ] **Step 5: Build the package to verify generated d.ts / dist entrypoints**

Run: `npm run build --workspace packages/opencode-plugin`
Expected: PASS and regenerated `packages/opencode-plugin/dist/index.js` plus `packages/opencode-plugin/dist/index.d.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/opencode-plugin/src/index.ts packages/opencode-plugin/package.json packages/opencode-plugin/tests/opencode-plugin.test.ts
git commit -m "feat: expose opencode server plugin entry"
```

### Task 3: Add a runtime-oriented smoke test for actual npm plugin loading

**Files:**
- Create: `packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts`
- Test: `packages/opencode-plugin/src/index.ts`
- Test: `packages/opencode-plugin/package.json`

- [ ] **Step 1: Write the failing smoke test scaffold**

Create a dedicated smoke test file that skips unless explicitly enabled.

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('OpenCode npm plugin smoke test', () => {
  it.runIf(process.env.OPENCODE_SMOKE === '1')(
    'loads the packed plugin through OpenCode without target-discovery errors',
    () => {
      const opencodeBin = process.env.OPENCODE_BIN ?? 'opencode'
      expect(opencodeBin).toBeTruthy()
    },
  )
})
```

This should fail once you flesh it out, because the package is not yet being packed and loaded through a temporary OpenCode config.

- [ ] **Step 2: Expand the smoke test to pack the local workspace package and start OpenCode with a temporary config**

Replace the body with a real loadability check.

```ts
it.runIf(process.env.OPENCODE_SMOKE === '1')(
  'loads the packed plugin through OpenCode without target-discovery errors',
  () => {
    const repoRoot = resolve(import.meta.dirname, '../../..')
    const opencodeBin = process.env.OPENCODE_BIN ?? 'opencode'
    const tempRoot = mkdtempSync(join(tmpdir(), 'opencode-plugin-smoke-'))
    tempDirs.push(tempRoot)

    const packDir = join(tempRoot, 'pack')
    const configDir = join(tempRoot, 'config')
    const configFile = join(configDir, 'opencode.json')
    mkdirSync(packDir, { recursive: true })
    mkdirSync(configDir, { recursive: true })

    const tarballName = execFileSync(
      'npm',
      ['pack', '--workspace', 'packages/opencode-plugin', '--pack-destination', packDir],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    ).trim().split('\n').at(-1)!

    writeFileSync(
      configFile,
      JSON.stringify(
        {
          $schema: 'https://opencode.ai/config.json',
          plugin: [`file:${join(packDir, tarballName)}`],
        },
        null,
        2,
      ),
    )

    const result = spawnSync(
      opencodeBin,
      ['--print-logs', '--log-level', 'DEBUG', 'session', 'list', '--format', 'json'],
      {
        cwd: tempRoot,
        env: {
          ...process.env,
          OPENCODE_CONFIG: configFile,
          OPENCODE_CONFIG_DIR: configDir,
          OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
        },
        encoding: 'utf8',
      },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).not.toContain('No plugin targets found')
    expect(result.stderr).not.toContain('resolved server entry outside plugin directory')
  },
)
```

- [ ] **Step 3: Run the smoke test in opt-in mode to verify it fails for the right reason**

Run: `OPENCODE_SMOKE=1 npm test -- --run packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts`
Expected: FAIL initially if OpenCode reports plugin-target discovery problems or if the new package metadata/entrypoint are not yet wired correctly.

- [ ] **Step 4: Make the smoke test robust for developer machines**

Finalize the smoke test with these guardrails:

```ts
const repoRoot = resolve(import.meta.dirname, '../../..')
const opencodeBin = process.env.OPENCODE_BIN ?? 'opencode'

try {
  execFileSync(opencodeBin, ['--version'], { stdio: 'ignore' })
} catch {
  return
}
```

Keep the test opt-in so normal CI stays fast and deterministic, and keep the directory setup explicit:

```ts
mkdirSync(packDir, { recursive: true })
mkdirSync(configDir, { recursive: true })
```

- [ ] **Step 5: Run the smoke test again after implementation is in place**

Run: `OPENCODE_SMOKE=1 npm test -- --run packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts`
Expected: PASS on a machine with `opencode` installed and current loader behavior matching the contract.

- [ ] **Step 6: Commit**

```bash
git add packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts
git commit -m "test: add opencode runtime smoke coverage"
```

### Task 4: Rewrite documentation around npm-native plugin usage

**Files:**
- Modify: `README.md`
- Modify: `packages/opencode-plugin/README.md`

- [ ] **Step 1: Rewrite the package README to center `opencode.json` usage**

Replace the current `import ... export default ...` guidance with npm plugin configuration.

````md
# @jdk-auto-switch/opencode-plugin

OpenCode npm plugin for command-scoped JDK switching in Maven projects.

## Install

```bash
npm install @jdk-auto-switch/opencode-plugin
```

## Configure OpenCode

Add the package to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@jdk-auto-switch/opencode-plugin"]
}
```

## Verify plugin loading

```bash
opencode --print-logs --log-level DEBUG session list --format json
```

This should not report plugin target-discovery errors for `@jdk-auto-switch/opencode-plugin`.

## Verify JDK switching

Run OpenCode in a Maven project and execute a Bash command such as `mvn test`.
The plugin will inject resolved `JAVA_HOME` / `PATH` through `shell.env` and block recognized-project executions when the required JDK is unavailable.
````

- [ ] **Step 2: Rewrite the root README package section to match the new package story**

Update the OpenCode section in `README.md` to match the package README.

````md
## OpenCode plugin usage

Install the package:

```bash
npm install @jdk-auto-switch/opencode-plugin
```

Add it to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@jdk-auto-switch/opencode-plugin"]
}
```

To debug loading:

```bash
opencode --print-logs --log-level DEBUG session list --format json
```
````

- [ ] **Step 3: Explicitly document version-sensitive loader behavior**

Add one short note to `packages/opencode-plugin/README.md` after the verification section.

```md
## Notes

- This package targets the current OpenCode npm plugin loader contract.
- Loader metadata and entrypoint expectations may change across OpenCode versions.
```

- [ ] **Step 4: Verify the docs do not describe the old helper-only flow as the primary install path**

Check that neither README still says this is the main setup:

```ts
import jdkAutoSwitch from '@jdk-auto-switch/opencode-plugin'

export default jdkAutoSwitch
```

If you want to keep that snippet at all, move it into a secondary “advanced / manual import” note instead of the primary instructions.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/opencode-plugin/README.md
git commit -m "docs: describe opencode npm plugin setup"
```

### Task 5: Verify the repository and smoke path end-to-end

**Files:**
- Verify: `packages/opencode-plugin/src/index.ts`
- Verify: `packages/opencode-plugin/package.json`
- Verify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`
- Verify: `packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts`
- Verify: `README.md`
- Verify: `packages/opencode-plugin/README.md`

- [ ] **Step 1: Run focused OpenCode plugin tests**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: PASS

- [ ] **Step 2: Run the smoke test when OpenCode CLI is available**

Run: `OPENCODE_SMOKE=1 npm test -- --run packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts`
Expected: PASS on machines with the `opencode` CLI installed; otherwise the test is skipped by design.

- [ ] **Step 3: Run full repository tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Run full repository build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 6: Inspect working tree before handing off**

Run: `git status --short`
Expected: only the intended files for the OpenCode npm plugin MVP remain modified or newly created.

- [ ] **Step 7: Commit**

```bash
git add packages/opencode-plugin/src/index.ts packages/opencode-plugin/package.json packages/opencode-plugin/tests/opencode-plugin.test.ts packages/opencode-plugin/tests/opencode-plugin.smoke.test.ts README.md packages/opencode-plugin/README.md
git commit -m "feat: ship opencode npm plugin mvp"
```
