# `@w32191` npm Scope Rename Design

## Goal

Rename the monorepo packages from the `@jdk-auto-switch` scope to the `@w32191` scope so the packages can be published from the current npm account without changing the existing release workflow shape.

## Package Naming

- `packages/core` → `@w32191/jdk-auto-switch-core`
- `packages/opencode-plugin` → `@w32191/jdk-auto-switch-opencode-plugin`
- `packages/claude-plugin` → rename to the matching `@w32191/...` internal package name as well, even though it remains private for now
- Keep the CLI binary name as `jdk-auto-switch`

## Why This Approach

Using one consistent scope across the whole monorepo avoids mixing public `@w32191/*` packages with private `@jdk-auto-switch/*` packages. It also keeps future docs, imports, release checks, and test fixtures aligned with the account that will actually publish the packages.

## Scope of Changes

The rename must update all places where package identity matters:

1. package manifests
   - package `name`
   - internal workspace dependency names
2. runtime imports and dynamic imports
3. tests and stub package paths that reference package names directly
4. release scripts that currently hardcode package names
5. README and spec/docs examples that show install/import/config usage
6. lockfile entries regenerated from package manifest changes

## Release Workflow Expectations

The release workflow stays structurally the same:

- publish core before dependent packages
- keep lockstep versioning
- keep package-level `build` / `test` / `pack:check`
- keep root `release:check` and `release:publish:dry-run`

Only the package identities change.

## Verification Plan

1. Add or update tests that assert the new package names and dependency wiring.
2. Run the full repository test suite.
3. Run `npm run release:check`.
4. Run `npm run release:publish:dry-run`.
5. Verify README and package examples now reference `@w32191/jdk-auto-switch-core` and `@w32191/jdk-auto-switch-opencode-plugin`.

## Non-Goals

- Changing the CLI command name
- Publishing `claude-plugin`
- Redesigning the current release workflow beyond the scope rename
