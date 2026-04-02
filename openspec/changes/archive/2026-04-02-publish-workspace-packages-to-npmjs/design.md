## Context

The repository is a private npm workspace with three versioned packages under `packages/*`: `@jdk-auto-switch/core`, `@jdk-auto-switch/opencode-plugin`, and `@jdk-auto-switch/claude-plugin`. The root workspace already supports shared build and test commands, but there is no explicit npm release contract yet: package manifests do not consistently declare packed-file boundaries, public publish settings, or publish-time validation, and the repository does not currently define how multi-package npm releases should be executed.

`core` and `opencode-plugin` already expose meaningful runtime entrypoints and version metadata, while `claude-plugin` currently looks closer to an internal integration package because it lacks a full npm entry surface and depends on non-code assets such as `.claude-plugin/plugin.json` and `hooks/hooks.json`. The design therefore needs to handle both publishable packages and packages that must remain gated until they meet the publishability contract.

## Goals / Non-Goals

**Goals:**
- Define a single publishability contract for workspace packages that are intended to ship on npmjs.
- Make package boundaries explicit so npm consumers receive only the files needed at runtime.
- Define a safe, repeatable multi-package release workflow, including version coordination and dependency-aware publish order.
- Prevent incomplete workspace packages from being accidentally published.
- Ensure repository and package documentation explain both maintainer release steps and consumer installation expectations.

**Non-Goals:**
- Building a fully automated release SaaS pipeline in this change.
- Changing package runtime behavior beyond what is necessary to make packages publishable.
- Introducing independent versioning for each package in the first release workflow.
- Expanding product scope beyond the existing core/OpenCode/Claude package set.

## Decisions

### 1. Use an explicit package publishability contract

Publishable workspace packages will be required to declare the metadata and packed contents needed for npm consumption: package name/version/description, license reference, entrypoints (`main`, `types`, `exports`, and `bin` or plugin metadata where relevant), public publish configuration for scoped packages, and a file whitelist that matches actual runtime needs. Packages that depend on extra assets outside `dist/` must explicitly include those assets in the packed output contract.

**Why:** npm publish should be deterministic. The current manifests are uneven, and relying on npm defaults would either over-pack repository content or under-pack runtime assets.

**Alternative considered:** Publish with minimal manifest changes and no `files` contract. Rejected because it increases accidental packaging risk and makes package contents hard to audit.

### 2. Keep non-ready packages gated instead of forcing every package public immediately

The release workflow will distinguish between packages that are ready to publish and packages that are not. A package that does not yet satisfy the publishability contract will remain excluded from publish scripts, typically by using package-level `private` gating or an equivalent explicit exclusion.

**Why:** the workspace currently contains packages at different maturity levels. Shipping all of them immediately would either force incomplete package surfaces onto npmjs or expand the implementation scope unnecessarily.

**Alternative considered:** Require all workspace packages to become publishable in the same cut. Rejected because it couples unrelated readiness work and increases release risk.

### 3. Use lockstep versioning with dependency-aware publish order

Published workspace packages will use coordinated versions for the initial npm release model. Release execution will publish packages in dependency order, with `@jdk-auto-switch/core` published before adapter packages that depend on it.

**Why:** the repository is still small, internal package dependencies already share exact versions, and lockstep versioning keeps release mechanics simple while the package surface stabilizes.

**Alternative considered:** independent package versioning. Rejected for now because it adds bookkeeping and compatibility complexity without a clear current benefit.

### 4. Validate with build/test/pack steps before publish

The maintainer release path will include package-scoped build and test execution plus `npm pack`-style validation before any `npm publish` step runs. Root-level orchestration may wrap these commands, but the package-level validation contract is the source of truth.

**Why:** publish-time failures should be discovered before anything is uploaded to npmjs, and `npm pack` is the closest local proof of what consumers will actually receive.

**Alternative considered:** rely on maintainers to remember manual build steps. Rejected because it is fragile and not auditable.

### 5. Start with a documented manual release flow, not CI automation

This change will define and implement a maintainer-operated npm release workflow, with room to add GitHub Actions or other automation later.

**Why:** the immediate goal is to make publication possible and safe. A documented manual path is enough to unlock releases without overdesigning automation before the package contract is stable.

**Alternative considered:** require CI-driven publish automation in the same change. Rejected to keep scope focused and lower rollout risk.

## Risks / Trade-offs

- **[Risk] `@jdk-auto-switch/claude-plugin` may need packaged non-code assets and a clearer runtime entry contract before it can be public.** → Mitigation: keep it excluded from publish until its install shape is validated, and require any non-code runtime assets to be listed in the packed-file contract.
- **[Risk] Lockstep versioning may force version bumps for packages with smaller changes.** → Mitigation: accept the operational simplicity trade-off while the workspace is still small; revisit independent versioning later if churn grows.
- **[Risk] Missing repository licensing creates npm distribution ambiguity.** → Mitigation: add a repository license artifact and reference it from publishable package manifests before release.
- **[Risk] Manual release execution can still fail due to operator error.** → Mitigation: provide a single documented command path with validation before publish and an explicit ordered release checklist.

## Migration Plan

1. Add the publishability contract to the affected package manifests and any required shared scripts.
2. Add or update release validation commands so maintainers can build, test, and pack each publishable package locally.
3. Update documentation for package consumers and maintainers.
4. Publish the first coordinated release in dependency order after validation succeeds.
5. If a bad version is released, do not rely on unpublish as the primary rollback; instead publish a corrected follow-up version and, if needed, deprecate the bad version on npmjs.

## Open Questions

- Should `@jdk-auto-switch/claude-plugin` become part of the first public npm release, or remain gated until its consumer installation story is documented end to end?
- Is the first release expected to be maintainer-local only, or should follow-up work add CI-assisted publish automation after the package contract lands?
