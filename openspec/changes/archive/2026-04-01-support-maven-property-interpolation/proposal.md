## Why

The current Maven signal parser only recognizes Java version values when they appear as direct literals in supported `pom.xml` properties or `maven-compiler-plugin` configuration. Real projects often express those values through property references such as `${java.version}` or chained `${maven.compiler.release}` indirection, which currently leads to `NO_SIGNAL` even though the project declares an explicit Java requirement.

## What Changes

- Extend Maven signal parsing to resolve supported property references before extracting Java major versions.
- Support property-indirected values in supported Maven properties and `maven-compiler-plugin` `source`/`target`/`release` fields.
- Preserve current source priority and fail-fast behavior while improving detection for common real-world parent and multi-module pom layouts.
- Add fixtures and tests that cover direct property indirection, chained property indirection, and unsupported/ambiguous reference cases.

## Capabilities

### New Capabilities
- `maven-pom-signal-resolution`: Resolve supported Maven property references so explicit Java version declarations in `pom.xml` can produce JDK signals even when they are expressed indirectly.

### Modified Capabilities
- None.

## Impact

- Affected code: `packages/core/src/signals/read-pom-signals.ts` and related resolver call sites if helper extraction changes are needed.
- Affected tests/fixtures: `packages/core/tests/read-pom-signals.test.ts` plus new or updated fixture poms for interpolated properties.
- User-visible behavior: projects that already declare Java requirements via `${...}` property references should resolve to a JDK instead of returning `NO_SIGNAL`.
