---
id: workspace-package-tests-need-local-vitest-config
date: 2026-04-02
scope: project
tags: [npm, workspaces, testing, vitest]
source: bug-fix
confidence: 0.5
related: [[npm-pack-needs-package-local-license]]
---

# Workspace package tests need a local Vitest config

## Context

Package-level `prepublishOnly` checks were added so each public workspace package could run `npm test` from its own directory before publication.

## Mistake

`@jdk-auto-switch/opencode-plugin` inherited the root Vitest config when run from the package directory, so `npm test` could not find its test files. Some core tests also used repo-root-relative fixture paths, which broke package-local test execution.

## Lesson

If a workspace package is expected to run `npm test` from the package root, give it a package-local Vitest config and keep test fixture paths relative to `import.meta.url` instead of assuming the repository root as the current working directory.

## When to Apply

Use this when adding package-level validation hooks such as `prepublishOnly`, `prepack`, or workspace-scoped CI steps that execute tests from inside each package directory.
