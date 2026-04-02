## Why

This workspace already contains versioned npm packages, but it does not yet have a clear contract for which packages are publishable, what metadata they must expose, or how publish-time validation should run. Defining that contract now is necessary to ship the packages through npmjs without ad hoc manual steps or inconsistent package quality.

## What Changes

- Define a workspace-level npm publishing capability for packages under `packages/*`.
- Establish package readiness requirements for publishable packages, including entry metadata, packed file boundaries, licensing, and publish-time build/validation safeguards.
- Define how multi-package versioning and npm release execution should work for this repository.
- Clarify how packages that are not yet ready for npmjs should be handled so they do not accidentally publish with incomplete metadata.
- Document the operator workflow for building, validating, and publishing workspace packages to npmjs.

## Capabilities

### New Capabilities
- `workspace-package-publishing`: Defines how workspace packages become publishable npm packages, how release validation runs, and how publish/release operations are performed across multiple packages.

### Modified Capabilities
- None.

## Impact

- `package.json` at the workspace root and package-level manifests under `packages/*`
- Build, validation, and release scripts for `@jdk-auto-switch/core`, `@jdk-auto-switch/opencode-plugin`, and `@jdk-auto-switch/claude-plugin`
- Repository documentation for install, release, and npm publishing workflows
- npm package consumers and maintainers responsible for publishing releases
