# JDK Auto Switch for OpenCode & Claude Code

Date: 2026-03-28
Status: Draft approved for planning

## Summary

Build a zero-intrusion plugin solution for OpenCode and Claude Code that detects the Java version required by the current Maven project and injects the correct JDK for AI-executed shell commands before compile/test/build commands run.

The design uses a shared core resolver plus thin tool-specific adapters. The resolver only trusts explicit existing signals, prefers exact-version matching, supports common command-level overrides such as `make JAVA=17 test`, and fails fast when the required JDK cannot be determined or is not installed.

## Problem

Developers often have multiple JDKs installed on the same machine, such as Java 8/11/17/21/25. Their current `JAVA_HOME` may point to one version while the Maven project they are working on needs another. When an AI coding tool runs `mvn compile` or `mvn test` under the wrong JDK, the first command fails for environment reasons instead of task reasons.

This is worse when:

- the AI tool only sees the current shell environment
- the project is wrapped by commands such as `make compile`
- machines vary across macOS and Windows
- JDKs are installed via different mechanisms

## Goals

- Automatically select the correct JDK for AI-executed shell commands in Maven projects.
- Work with both OpenCode and Claude Code.
- Keep the switching scope local to the AI-executed command environment only.
- Support wrapper commands such as `make`, `mvnw`, and shell scripts indirectly via environment injection.
- Prefer exact major-version matching when the required version is explicit.
- Fail fast with actionable errors instead of letting Maven fail first.
- Require zero repo intrusion for v1.
- Support auto-discovery of installed JDKs plus user-configured overrides.

## Non-Goals

- Changing the developer's global system JDK.
- Supporting Gradle deeply in v1.
- Understanding arbitrary Makefile or shell-script semantics.
- Requiring a new repo manifest file in v1.
- Treating IntelliJ-managed JDK locations as a supported v1 inventory source.
- Solving every dynamic Maven model edge case.

## Chosen Product Shape

The selected direction is a hybrid of:

1. **Shared core resolver** for all JDK/version logic.
2. **Thin adapters** for OpenCode and Claude Code.
3. **CLI-compatible internal interface** so the core can later be exposed as a wrapper/doctor tool without coupling logic to plugin APIs.

This keeps the decision logic testable and reusable while allowing each tool to use its native interception mechanism.

## Core Design Principle

The system resolves a **best explicit execution JDK** for the current command. It does not guess from weak signals.

It distinguishes between:

- **command-level overrides**: explicit values passed in the current command
- **project-level explicit signals**: existing version declarations already present in the repo
- **local machine inventory**: installed JDKs available for selection

The resolver prefers **exact major-version matching**. If the project or command explicitly points to Java 17, the resolver should prefer JDK 17 rather than keeping JDK 21 just because 21 may also work.

## High-Level Architecture

### 1. Adapters

Thin integrations for each AI tool.

- **OpenCode adapter**
  - intercepts shell execution before tool run
  - sends `cwd` and `command` to the core resolver
  - injects resolved env into the shell execution
  - blocks execution with a clear error if resolution fails

- **Claude Code adapter**
  - uses hooks around Bash execution and cwd changes
  - sends `cwd` and `command` to the core resolver
  - injects env through supported session/env mechanisms when possible
  - falls back to command rewriting when direct env injection is insufficient
  - blocks execution with a clear error if resolution fails

### 2. Shared Core Resolver

The resolver owns all logic for:

- project detection
- command override parsing
- explicit signal extraction from repo files
- local JDK inventory discovery and validation
- candidate selection
- failure reasons and explanation output

### 3. Diagnostics Surface

The system must support explainability and debugging through user-visible diagnostics, including:

- explain why a JDK was selected
- show available JDK inventory
- show why resolution failed

## Execution Flow

1. AI tool is about to execute a shell command.
2. Adapter captures `cwd` and raw command text.
3. Resolver identifies whether the current directory belongs to a Maven project.
4. Resolver extracts command-level explicit overrides.
5. Resolver extracts project-level explicit signals from existing repo files.
6. Resolver builds a constraint set and resolves the required Java major version.
7. Resolver matches that requirement against the local JDK inventory.
8. Adapter injects `JAVA_HOME` and prepends the selected JDK `bin` directory to `PATH` for this execution only.
9. Original shell command runs under the resolved JDK.
10. If resolution fails, the command is blocked and an actionable error is returned.

## Project Detection

v1 only targets Maven projects.

Resolver behavior:

- walk upward from `cwd`
- find the nearest relevant `pom.xml`
- determine the effective project root or module context using file location, not by invoking Maven
- if no Maven context exists, do nothing

The adapter should only inject JDK env when the command runs inside a recognized Maven project context.

## Explicit Signal Sources

### Priority Order

From highest to lowest priority:

1. **Command-level explicit overrides**
2. **Repo-local existing version files**
3. **Maven explicit configuration parsed statically**
4. **User manual JDK path overrides for inventory selection only**

If sources at the same priority level conflict, resolution fails.

### A. Command-Level Explicit Overrides

v1 supports common explicit patterns only.

Examples:

- `make JAVA=17 test`
- `mvn -Djava.version=17 test`
- `mvn -Dmaven.compiler.release=21 verify`

Rules:

- only recognized patterns count
- unrecognized property names are ignored rather than guessed
- if a recognized override produces a single explicit version, it wins
- if multiple recognized overrides conflict, resolution fails

### B. Existing Repo Version Files

v1 may consume existing repo-local files if they already exist, including:

- `.java-version`
- `.tool-versions`
- `.sdkmanrc`

These are treated as explicit version declarations because they already represent repo-level toolchain intent.

### C. Static Maven Signals

v1 parses Maven configuration statically and conservatively. It does **not** rely on running Maven to determine which JDK to use.

Signals accepted in v1:

- `maven-enforcer-plugin` Java version constraints when statically readable
- `maven-compiler-plugin` `release`
- `maven.compiler.release`
- `source` / `target`
- `maven.compiler.source` / `maven.compiler.target`
- statically readable toolchain-related configuration

Important constraint:

- v1 treats these as explicit build/execution signals for practical selection purposes
- it does not attempt to compute a full effective Maven model through Maven execution
- dynamic or remote-only resolution paths are out of scope

### D. Unsupported Signal Sources in v1

The resolver rejects or ignores cases that need guesswork, such as:

- remote parent POM resolution to discover the version
- dynamic profile activation requiring Maven execution to know the answer
- arbitrary Makefile logic
- arbitrary shell-script logic
- CI configuration as the primary source of truth
- IntelliJ-managed JDK locations as inventory input

## Exact-Match Resolution Policy

Selected rule for v1:

- if the explicit resolved requirement is Java 17, prefer JDK 17
- do not keep JDK 21 merely because it might still satisfy the build

Rationale:

- aligns better with developer intent
- reduces cross-version surprises
- matches the product goal of project-consistent execution, not merely minimum compatibility

If only a range can be derived and the system cannot deterministically choose a single exact major version, resolution fails in v1.

## Wrapper Command Policy

Wrapper commands are supported indirectly by environment injection, not by fully understanding wrapper semantics.

Examples supported through interception:

- `make compile`
- `make JAVA=17 test`
- `./mvnw verify`
- `bash scripts/build.sh`

Rules:

- the adapter intercepts shell execution at the project boundary
- the resolver inspects the raw command for recognized explicit override patterns
- otherwise, wrapper commands inherit the project-resolved JDK env
- v1 does not attempt to interpret arbitrary target-specific Makefile logic

## Local JDK Inventory

### Inventory Model

Each discovered JDK is normalized as:

- `major`
- `fullVersion`
- `javaHome`
- `javaBin`
- `javacBin`
- `vendor`
- `arch`
- `source`
- `validated`

### Inventory Sources

Priority order:

1. **User manual overrides**
2. **Platform-native standard locations**
3. **Version-manager-managed locations**

#### macOS

- `/usr/libexec/java_home -V`
- `/Library/Java/JavaVirtualMachines/*/Contents/Home`
- common package-manager or version-manager locations such as SDKMAN, asdf, mise, or Homebrew

#### Windows

- Registry entries
- common installation directories such as `C:\Program Files\Java\` and common vendor paths
- common version-manager locations when enabled

### Excluded v1 Inventory Source

- IntelliJ IDEA downloaded or managed JDKs are excluded from v1 support

### Validation

Discovered candidates are not trusted blindly.

Validation steps:

- verify `java` exists
- verify `javac` exists when required
- run `java -version`
- cache validation results

## Candidate Selection

Selection order:

1. exact major-version match from manual override inventory
2. exact major-version match from validated standard locations
3. exact major-version match from validated version-manager locations

If multiple candidates exist within the same bucket, select deterministically using stable ordering and optional future vendor preferences.

If no exact match exists, fail fast in v1.

## Adapter Responsibilities

### OpenCode Adapter Responsibilities

- intercept shell execution before run
- ask resolver for a decision
- inject env into the command execution
- block the command on unresolved or missing JDK

### Claude Code Adapter Responsibilities

- intercept Bash execution using supported hooks
- ask resolver for a decision
- inject env through supported mechanisms
- fall back to command rewriting when required by platform/tool limits
- block the command on unresolved or missing JDK

### Shared Adapter Constraint

Adapters must stay thin. They must not duplicate Maven parsing or JDK inventory logic.

## Error Handling

The resolver must fail fast and return actionable errors.

### Error Cases

- no explicit version could be determined
- explicit sources conflict
- required JDK is not installed
- multiple conflicting command overrides were found
- dynamic Maven logic is required to know the answer

### Error Message Requirements

Each failure should include:

- detected project path
- command seen
- source(s) examined
- version or conflict found
- installed JDK majors available locally
- suggested next action

Example:

```text
Detected required Java major: 25
Source: maven-compiler-plugin release
Installed JDK majors: 17, 21
Action: install JDK 25 or configure a manual path override
```

## Diagnostics UX

v1 should include three user-facing diagnostic surfaces:

### Explain

Show:

- selected JDK
- why it was selected
- which sources were used
- which sources were ignored

### Doctor

Show:

- discovered JDK inventory
- invalid JDK paths
- missing majors compared to recent project needs

### Trace / Verbose

Short adapter trace for debugging interception behavior.

Example:

- intercepted `make JAVA=17 test`
- recognized override `JAVA=17`
- selected `/path/to/jdk17`
- env injected

## Caching

To avoid repeated heavy parsing and validation, cache decisions using a key derived from:

- project root
- relevant file hashes or mtimes for version-bearing files
- recognized command override signature

Invalidate cache when:

- cwd moves to another project
- relevant files change
- command override signature changes
- user config changes

## Platform Scope

v1 targets:

- macOS native
- Windows native

The architecture should leave room for WSL-aware handling later, but WSL-specific behavior is not a v1 requirement.

## Testing Strategy

### 1. Unit Tests

- command override parser
- repo version-file parsers
- static Maven parser
- conflict detection
- exact-match candidate selection
- inventory normalization and validation parsing

### 2. Fixture Integration Tests

Use repository fixtures for:

- single-module Maven project
- multi-module project with local parent
- command override via `make JAVA=17 test`
- command override via `mvn -Djava.version=21 test`
- missing required JDK
- conflicting explicit sources
- existing `.java-version` or `.tool-versions`

### 3. Adapter Tests

- OpenCode env injection behavior
- Claude Code hook/env rewrite behavior
- failure blocking behavior

## Phased Delivery

### Phase 1

- shared resolver library
- macOS + Windows inventory discovery
- static Maven parsing for explicit sources
- OpenCode adapter
- common diagnostics

### Phase 2

- Claude Code adapter
- broader override coverage
- better conflict explanation

### Deferred Beyond v1

- IntelliJ-managed JDK inventory
- Gradle support
- arbitrary wrapper rule engine
- repo manifest file as an optional future enhancement
- WSL-specialized behavior

## Key Decisions Captured

- zero repo intrusion for v1
- AI-command-scoped JDK switching only
- Maven only for v1
- common wrapper commands supported indirectly through env injection
- exact-match preferred over minimum-satisfying behavior
- explicit signals only; no guessing
- fail fast on ambiguity or missing JDK
- shared core resolver plus thin OpenCode and Claude Code adapters
