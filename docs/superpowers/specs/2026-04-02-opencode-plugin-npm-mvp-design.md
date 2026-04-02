# OpenCode npm Plugin MVP Design

## Goal

Define `@jdk-auto-switch/opencode-plugin` as a real npm-native OpenCode plugin that the current OpenCode runtime can discover and load, instead of only a helper module that happens to return hooks.

## Problem Statement

The current branch already implements useful OpenCode hook behavior:

- `shell.env`
- `tool.execute.before`

It also includes package exports, tests, and documentation. However, that is not sufficient for the actual product goal if the intended deliverable is an npm plugin that can be declared directly in `opencode.json`.

OpenCode's public plugins documentation describes plugins as JS/TS modules that export one or more plugin functions. The currently installed `@opencode-ai/plugin` type package also defines a `PluginModule` shape with a `server` target, and recent OpenCode loader behavior additionally expects npm plugin metadata in `package.json` for plugin target discovery. Therefore, the MVP must be defined around runtime loadability, not just hook correctness.

## MVP Definition

The MVP is:

> A published npm package named `@jdk-auto-switch/opencode-plugin` that can be referenced from `opencode.json`, is detected and loaded by the current OpenCode plugin loader, and applies JDK resolution to Maven-related shell execution through `shell.env` and `tool.execute.before`.

## Success Criteria

1. A user can reference the package from `opencode.json` using the `plugin` array.
2. OpenCode can discover and load the package as a server plugin in the current supported version.
3. The plugin exposes the minimum server-side hooks needed for Maven JDK switching:
   - `shell.env`
   - `tool.execute.before`
4. In a Maven project:
   - successful resolution injects JDK environment variables
   - recognized-project-but-missing-JDK cases fail with a clear error
   - `NO_PROJECT` cases pass through without blocking execution
5. The README documents a real install/configure/verify flow for npm plugin usage.
6. Validation includes at least one runtime-oriented plugin loading check, not only unit tests.

## Non-Goals

This MVP does not include:

- TUI plugin support
- OpenCode custom tools
- Gradle or other non-Maven build-tool support
- Broad backward-compatibility guarantees across all OpenCode versions
- Unifying the OpenCode and Claude integrations behind a larger abstraction layer

## Architecture

### Package responsibility

`packages/opencode-plugin` is a product package for OpenCode runtime consumption.

It should be treated as:

- a publishable npm plugin package
- a package whose external entrypoint is designed for OpenCode loader compatibility
- a package that still keeps hook assembly testable through internal helper functions

It should not be treated primarily as a generic helper library.

### Module shape

The design separates two concerns:

1. **Internal hook factory**
   - `createOpenCodePlugin(...)`
   - Used for unit tests and dependency injection

2. **Runtime plugin entrypoint**
   - A `server` plugin target exported in the form expected by current OpenCode type and loader behavior
   - This is the entrypoint that determines whether the package is truly usable as an npm plugin

If a default export is retained, it is secondary. The MVP should optimize for loader compatibility over stylistic preference.

### Package metadata

`package.json` must satisfy both standard npm/Node consumers and OpenCode plugin discovery.

Minimum metadata responsibilities:

- standard JS package entry information (`exports`, `main`, `types`)
- plugin-target discovery metadata required by the current OpenCode npm loader

The exact metadata must be validated against current loader expectations. At the time of writing, recent OpenCode behavior indicates target discovery through `package.json` plugin metadata rather than inference from a bare exported function.

## Runtime Flow

```text
OpenCode startup
  -> npm plugin discovery
  -> package identified as server plugin
  -> server plugin loaded
  -> hooks registered
      -> shell.env
      -> tool.execute.before
```

### `shell.env`

Responsibility:

- resolve the JDK for the current working directory
- inject resolved environment values into `output.env`
- remain conservative when no resolution is possible

Behavior:

- on resolved result: merge resolver-provided env (`JAVA_HOME`, `PATH`, etc.) into output
- on unresolved result: do not throw from this hook; preserve default shell behavior

### `tool.execute.before`

Responsibility:

- inspect tool execution before Bash commands run
- resolve the JDK using working directory plus command context
- either rewrite the command with resolved environment or block execution when the project is recognized but requirements cannot be met

Behavior:

- ignore non-`bash` tools
- ignore calls that do not contain a command string
- on resolved result: rewrite command with exported env assignments
- on unresolved `NO_PROJECT`: pass through
- on unresolved recognized-project failures such as missing required JDK: throw actionable error

## Testing Strategy

The MVP requires three layers of validation.

### 1. Unit tests

Validate hook behavior directly via `createOpenCodePlugin(...)`:

- `shell.env` merges resolved env
- unresolved `shell.env` does not mutate env unexpectedly
- `tool.execute.before` rewrites Bash commands on success
- `tool.execute.before` ignores non-Bash tools
- `tool.execute.before` passes through `NO_PROJECT`
- `tool.execute.before` throws on recognized-project missing-JDK cases

### 2. Contract tests

Validate package and entrypoint shape:

- package exports point to built artifacts
- plugin metadata needed by current OpenCode loader is present
- runtime-facing entry exposes the expected server plugin target
- the server entry can be invoked and returns hooks containing the supported events

### 3. Runtime loading smoke test

This is the core MVP-specific validation.

At minimum, validation should prove that:

- a minimal OpenCode config can reference the package through the `plugin` array
- OpenCode no longer reports plugin-target discovery failure for this package
- the plugin is loaded strongly enough that at least one hook path is exercised or observable

If a full end-to-end automated smoke test is too heavy for the first cut, the fallback is a loader-oriented test that simulates package metadata and entrypoint loading. That fallback is acceptable only as an interim step and should be documented as weaker evidence.

## Documentation Requirements

The README should be organized around npm-native plugin usage:

1. install the package
2. add it to `opencode.json`
3. start OpenCode
4. verify that plugin loading succeeded
5. verify behavior inside a Maven project
6. call out known version-sensitive loader assumptions

The docs must avoid implying that a plain `import ... export default ...` helper pattern alone is the primary supported installation path for this MVP.

## Risks and Constraints

1. **OpenCode documentation vs runtime behavior drift**
   - Public docs still emphasize exported plugin functions.
   - Current installed type/runtime ecosystem shows explicit `server` target modeling and plugin metadata expectations.

2. **Loader behavior may be version-sensitive**
   - The npm plugin MVP is inherently tied to the current supported OpenCode version.
   - The supported version should be made explicit in tests and docs.

3. **Metadata contract may be under-documented**
   - Some required package metadata may come from runtime behavior or issues rather than stable docs.
   - The MVP should validate actual behavior, not trust documentation alone.

## Recommended Implementation Boundary

The next implementation plan should focus only on:

1. reshaping the package entry for loader compatibility
2. adding loader-relevant package metadata
3. updating tests toward runtime/plugin-contract validation
4. rewriting docs around npm-native plugin usage

It should explicitly avoid expanding product surface beyond that scope.
