# OpenCode Plugin MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@jdk-auto-switch/opencode-plugin` loadable by OpenCode as a real plugin module, document how to use it, and verify the contract with tests.

**Architecture:** Keep the existing resolver-backed hook behavior intact, but wrap it in a module shape that matches `@opencode-ai/plugin`'s `PluginModule` contract. Add documentation and contract-focused tests around the entrypoint instead of expanding the product surface.

**Tech Stack:** TypeScript, Vitest, tsup, npm workspaces, `@opencode-ai/plugin` type contract

---

### Task 1: Add failing contract tests for the OpenCode module shape

**Files:**
- Modify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`
- Reference: `.opencode/node_modules/@opencode-ai/plugin/dist/index.d.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that the package default export exposes a `server` function and that invoking it returns the expected `shell.env` and `tool.execute.before` hooks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: FAIL because the default export is currently a hook object, not a plugin module with `server`.

- [ ] **Step 3: Write minimal implementation**

Update `packages/opencode-plugin/src/index.ts` so it exports both the hook factory and an OpenCode-compatible module entry with `server`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: PASS

### Task 2: Tighten package exports for external loading

**Files:**
- Modify: `packages/opencode-plugin/package.json`
- Test: `packages/opencode-plugin/tests/opencode-plugin.test.ts`

- [ ] **Step 1: Write the failing test**

Add assertions that `package.json` exposes `exports["."]` pointing at `./dist/index.js` and `./dist/index.d.ts`, mirroring the core package contract.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: FAIL because `exports` is not declared yet.

- [ ] **Step 3: Write minimal implementation**

Add `exports` to `packages/opencode-plugin/package.json` without broadening the public API beyond the main entry.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: PASS

### Task 3: Document minimum usage for developers

**Files:**
- Modify: `README.md`
- Create: `packages/opencode-plugin/README.md`

- [ ] **Step 1: Write the documentation update**

Document install/import/enable/verify steps for the OpenCode plugin, clearly distinguishing package usage from the CLI and Claude adapter.

- [ ] **Step 2: Verify docs against implementation**

Check that the documented entry shape matches the code (`default export` + `server`) and that no undocumented setup is implied.

### Task 4: Verify the repository stays healthy

**Files:**
- Verify: `packages/opencode-plugin/src/index.ts`
- Verify: `packages/opencode-plugin/package.json`
- Verify: `packages/opencode-plugin/tests/opencode-plugin.test.ts`
- Verify: `README.md`
- Verify: `packages/opencode-plugin/README.md`

- [ ] **Step 1: Run package-level tests**

Run: `npm test -- --run packages/opencode-plugin/tests/opencode-plugin.test.ts`
Expected: PASS

- [ ] **Step 2: Run full repository tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run full repository build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS
