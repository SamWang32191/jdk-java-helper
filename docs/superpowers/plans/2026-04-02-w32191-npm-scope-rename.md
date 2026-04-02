# `@w32191` npm Scope Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the workspace packages from `@jdk-auto-switch/*` to `@w32191/*` so the current npm account can publish them without changing the existing release workflow.

**Architecture:** Keep the current workspace/package layout, CLI binary, and release order, but rename package identities everywhere they matter: manifests, internal dependencies, runtime imports, tests, release scripts, docs, and the lockfile. Use small TDD loops: update contract tests first, watch them fail, then make the minimal manifest/script/doc changes to turn them green.

**Tech Stack:** npm workspaces, TypeScript, Vitest, Node.js ESM, OpenSpec markdown specs

---

## File Map

- Modify: `packages/core/package.json`
- Modify: `packages/opencode-plugin/package.json`
- Modify: `packages/claude-plugin/package.json`
- Modify: `packages/core/tests/publish-contract.test.ts`
- Modify: `packages/core/tests/release-workflow-contract.test.ts`
- Modify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`
- Modify: `packages/claude-plugin/tests/claude-hook.test.ts`
- Modify: `packages/opencode-plugin/src/index.ts`
- Modify: `packages/claude-plugin/scripts/jdk-hook.mjs`
- Modify: `scripts/release-version-check.mjs`
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `packages/opencode-plugin/README.md`
- Modify: `openspec/specs/workspace-package-publishing/spec.md`
- Modify: `package-lock.json`

### Task 1: Rename package identities in manifests and contract tests

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/opencode-plugin/package.json`
- Modify: `packages/claude-plugin/package.json`
- Modify: `packages/core/tests/publish-contract.test.ts`
- Modify: `packages/core/tests/release-workflow-contract.test.ts`
- Modify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`

- [ ] **Step 1: Write the failing test expectations for the new package names**

Update the contract tests so they expect the new names and internal dependency keys before any manifest changes are made.

```ts
// packages/core/tests/release-workflow-contract.test.ts
expect(opencodePkg.dependencies?.['@w32191/jdk-auto-switch-core']).toBe(corePkg.version)
expect(claudePkg.dependencies?.['@w32191/jdk-auto-switch-core']).toBe(corePkg.version)

// packages/opencode-plugin/tests/opencode-plugin.test.ts
expect(packageJson.name).toBe('@w32191/jdk-auto-switch-opencode-plugin')

// packages/core/tests/publish-contract.test.ts
expect(corePkg.name).toBe('@w32191/jdk-auto-switch-core')
expect(opencodePkg.name).toBe('@w32191/jdk-auto-switch-opencode-plugin')
expect(claudePkg.name).toContain('@w32191/')
```

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- packages/core/tests/publish-contract.test.ts packages/core/tests/release-workflow-contract.test.ts packages/opencode-plugin/tests/opencode-plugin.test.ts`

Expected: FAIL because manifests still say `@jdk-auto-switch/*` and dependency keys still use `@jdk-auto-switch/core`.

- [ ] **Step 3: Rename the manifests with the minimal package identity changes**

Apply these manifest changes:

```json
// packages/core/package.json
{
  "name": "@w32191/jdk-auto-switch-core"
}

// packages/opencode-plugin/package.json
{
  "name": "@w32191/jdk-auto-switch-opencode-plugin",
  "dependencies": {
    "@w32191/jdk-auto-switch-core": "0.1.0"
  }
}

// packages/claude-plugin/package.json
{
  "name": "@w32191/jdk-auto-switch-claude-plugin",
  "dependencies": {
    "@w32191/jdk-auto-switch-core": "0.1.0"
  }
}
```

Also extend the JSON-reading test helper types so `name?: string` can be asserted directly.

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `npm test -- packages/core/tests/publish-contract.test.ts packages/core/tests/release-workflow-contract.test.ts packages/opencode-plugin/tests/opencode-plugin.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/package.json packages/opencode-plugin/package.json packages/claude-plugin/package.json packages/core/tests/publish-contract.test.ts packages/core/tests/release-workflow-contract.test.ts packages/opencode-plugin/tests/opencode-plugin.test.ts
git commit -m "refactor: rename workspace package identities"
```

### Task 2: Update runtime imports, release checks, and package-local stubs

**Files:**
- Modify: `packages/opencode-plugin/src/index.ts`
- Modify: `packages/claude-plugin/scripts/jdk-hook.mjs`
- Modify: `packages/claude-plugin/tests/claude-hook.test.ts`
- Modify: `scripts/release-version-check.mjs`

- [ ] **Step 1: Keep the build/test path red by asserting the new core package name in runtime-facing places**

Update the runtime-facing tests first:

```ts
// packages/claude-plugin/tests/claude-hook.test.ts
const stubCoreDir = fileURLToPath(new URL('../node_modules/@w32191/jdk-auto-switch-core', import.meta.url))
JSON.stringify({ name: '@w32191/jdk-auto-switch-core', type: 'module', exports: { '.': './index.mjs' } })
rmSync(new URL('../node_modules/@w32191', import.meta.url), { recursive: true, force: true })
```

And update the release check expectations to use the renamed core package key.

- [ ] **Step 2: Run the focused package tests to verify they fail**

Run: `npm test -- packages/claude-plugin/tests/claude-hook.test.ts packages/core/tests/release-workflow-contract.test.ts`

Expected: FAIL because the production imports and `scripts/release-version-check.mjs` still reference `@jdk-auto-switch/core`.

- [ ] **Step 3: Make the minimal runtime and script changes**

Update the old import strings and hardcoded package names:

```ts
// packages/opencode-plugin/src/index.ts
import type { ResolveInput, ResolveResult } from '@w32191/jdk-auto-switch-core'
const { resolveJdk } = await import('@w32191/jdk-auto-switch-core')

// packages/claude-plugin/scripts/jdk-hook.mjs
import { resolveJdk as coreResolveJdk } from '@w32191/jdk-auto-switch-core'
```

```js
// scripts/release-version-check.mjs
const packageSpecs = [
  { name: '@w32191/jdk-auto-switch-core', path: 'packages/core/package.json', publishable: true },
  { name: '@w32191/jdk-auto-switch-opencode-plugin', path: 'packages/opencode-plugin/package.json', publishable: true },
  { name: '@w32191/jdk-auto-switch-claude-plugin', path: 'packages/claude-plugin/package.json', publishable: false },
]

const coreVersion = packages.find((pkg) => pkg.name === '@w32191/jdk-auto-switch-core')?.manifest.version
const declaredCoreVersion = pkg.manifest.dependencies?.['@w32191/jdk-auto-switch-core']
```

- [ ] **Step 4: Run the focused package tests to verify they pass**

Run: `npm test -- packages/claude-plugin/tests/claude-hook.test.ts packages/core/tests/release-workflow-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/opencode-plugin/src/index.ts packages/claude-plugin/scripts/jdk-hook.mjs packages/claude-plugin/tests/claude-hook.test.ts scripts/release-version-check.mjs packages/core/tests/release-workflow-contract.test.ts
git commit -m "refactor: align runtime imports with w32191 scope"
```

### Task 3: Update docs, spec references, and lockfile

**Files:**
- Modify: `README.md`
- Modify: `packages/core/README.md`
- Modify: `packages/opencode-plugin/README.md`
- Modify: `openspec/specs/workspace-package-publishing/spec.md`
- Modify: `package-lock.json`

- [ ] **Step 1: Add a failing docs/spec contract test**

Create or extend a test that reads the public-facing docs and spec and asserts they use the new package names.

```ts
// packages/core/tests/publish-contract.test.ts
expect(readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')).toContain('@w32191/jdk-auto-switch-core')
expect(readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')).toContain('@w32191/jdk-auto-switch-opencode-plugin')
expect(readFileSync(new URL('../../../openspec/specs/workspace-package-publishing/spec.md', import.meta.url), 'utf8')).toContain('@w32191/jdk-auto-switch-core')
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `npm test -- packages/core/tests/publish-contract.test.ts`

Expected: FAIL because README/spec still mention `@jdk-auto-switch/*`.

- [ ] **Step 3: Update the public-facing names and regenerate the lockfile**

Make these exact doc/spec changes:

```md
<!-- README.md -->
- `@w32191/jdk-auto-switch-core` — public npm package for resolver logic, diagnostics, and CLI
- `@w32191/jdk-auto-switch-opencode-plugin` — public npm package for the OpenCode adapter

```bash
npm install @w32191/jdk-auto-switch-opencode-plugin
```

```json
{ "plugin": ["@w32191/jdk-auto-switch-opencode-plugin"] }
```

<!-- packages/core/README.md -->
# @w32191/jdk-auto-switch-core

```bash
npm install @w32191/jdk-auto-switch-core
```

```ts
import { resolveJdk } from '@w32191/jdk-auto-switch-core'
```

<!-- packages/opencode-plugin/README.md -->
# @w32191/jdk-auto-switch-opencode-plugin

```bash
npm install @w32191/jdk-auto-switch-opencode-plugin
```

```ts
import jdkAutoSwitch from '@w32191/jdk-auto-switch-opencode-plugin'
```
```

Update the OpenSpec main spec examples to the new core package name, then regenerate the lockfile:

Run: `npm install`

Expected: `package-lock.json` now contains `@w32191/jdk-auto-switch-core` and `@w32191/jdk-auto-switch-opencode-plugin` entries instead of the old public names.

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `npm test -- packages/core/tests/publish-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/core/README.md packages/opencode-plugin/README.md openspec/specs/workspace-package-publishing/spec.md package-lock.json packages/core/tests/publish-contract.test.ts
git commit -m "docs: update published package references to w32191 scope"
```

### Task 4: End-to-end verification of the renamed release flow

**Files:**
- Verify only: current workspace files from Tasks 1-3

- [ ] **Step 1: Run the full repository test suite**

Run: `npm test`

Expected: PASS with all repository tests green and the existing optional smoke test still skipped unless explicitly enabled.

- [ ] **Step 2: Run the release validation workflow**

Run: `npm run release:check`

Expected: PASS. The version check script should report the `@w32191/*` package names and the package-level `npm pack --dry-run` steps should succeed.

- [ ] **Step 3: Rehearse the ordered publish flow**

Run: `npm run release:publish:dry-run`

Expected: PASS. Output should dry-run publish `packages/core` before `packages/opencode-plugin`.

- [ ] **Step 4: Spot-check the renamed install/import strings**

Run:

```bash
rg '@jdk-auto-switch/(core|opencode-plugin)' README.md packages openspec/specs package-lock.json
```

Expected: no matches for the old public names outside historical/archive documents that are intentionally unchanged.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify w32191 release flow"
```
