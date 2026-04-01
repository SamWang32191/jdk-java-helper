## 1. Expand Maven signal fixtures and parser tests

- [x] 1.1 Add or update fixture poms that cover same-file property interpolation, chained property interpolation, and unresolved/cyclic property references for supported Maven signal fields.
- [x] 1.2 Extend `packages/core/tests/read-pom-signals.test.ts` to verify interpolated `maven.compiler.*` properties and `maven-compiler-plugin` `source`/`target`/`release` values resolve to Java majors.
- [x] 1.3 Add parser tests for child-module poms that inherit `${java.version}` from a supported local parent, including default `../pom.xml` parent lookup.

## 2. Implement bounded Maven property resolution

- [x] 2.1 Refactor `packages/core/src/signals/read-pom-signals.ts` to build property maps from the current pom and supported local parent pom before parsing supported signal fields.
- [x] 2.2 Add a bounded property-resolution helper that resolves chained `${...}` references, detects cycles, and returns no signal for unresolved or unsupported references.
- [x] 2.3 Apply interpolation only to the currently supported Maven property keys and `maven-compiler-plugin` `release`/`source`/`target` fields without expanding overall Maven signal scope.

## 3. Verify resolver behavior stays stable

- [x] 3.1 Add or update resolver-level tests where interpolated Maven signals now produce resolved JDK selection instead of `NO_SIGNAL`.
- [x] 3.2 Add or update resolver-level tests for interpolated Maven conflicts or unresolved references so existing `CONFLICT` and fail-soft behavior remain explicit.
- [x] 3.3 Run the relevant core test suites and full repository verification (`npm test`, `npm run build`, and `npm run typecheck`) after the interpolation change is implemented.
