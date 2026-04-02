---
id: clean-worktrees-need-build-for-package-import-tests
date: 2026-04-02
scope: project
tags: [worktrees, testing, build, npm]
source: bug-fix
confidence: 0.5
related: [[workspace-package-tests-need-local-vitest-config]]
---

# Clean worktrees need a build before package-import tests

## Context

In a fresh git worktree, running the repository test suite immediately caused workspace-package imports like `@jdk-auto-switch/core` to fail resolution inside dependent package tests.

## Mistake

I assumed `npm test` alone was a valid clean baseline, but some tests load package entrypoints that point at generated `dist/` files. A fresh worktree does not have those build artifacts yet.

## Lesson

If tests resolve workspace packages through their published package entrypoints, a clean worktree needs `npm run build` before `npm test`. Otherwise baseline failures can look like package-resolution bugs when the real issue is missing generated output.

## When to Apply

Use this when validating a fresh worktree, CI reproduction, or any clean checkout where tests import workspace packages via package names instead of source-relative paths.
