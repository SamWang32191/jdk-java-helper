## Context

`read-pom-signals.ts` currently extracts Java majors from a narrow static subset of Maven fields: `maven.compiler.release`, `maven.compiler.source`, `maven.compiler.target`, and `maven-compiler-plugin` `release`/`source`/`target`. The extractor only succeeds when those fields already contain a literal version string such as `17` or `21`. Real Maven projects commonly route those values through property references like `${java.version}` or chained references such as `${maven.compiler.release}`. In those cases, the repository is correctly identified as a Maven project, but signal extraction returns an empty set and the resolver falls through to `NO_SIGNAL`.

The change needs to improve real-world compatibility without turning the parser into a full Maven model evaluator. The current resolver behavior, source priority, and bounded local-parent lookup should remain intact.

## Goals / Non-Goals

**Goals:**
- Resolve supported Maven Java-version fields when their values are expressed through property references.
- Support common same-file and local-parent property inheritance patterns used by multi-module Maven projects.
- Keep parsing deterministic, bounded, and testable, with explicit behavior for unresolved or cyclic references.
- Preserve the existing signal-source ordering and unsupported-plugin behavior.

**Non-Goals:**
- Full Maven effective-model evaluation.
- Remote parent resolution, profile activation, environment-variable interpolation, or arbitrary plugin parsing.
- Broadening signal support beyond the currently supported Maven property keys and `maven-compiler-plugin` fields.

## Decisions

### 1. Resolve property references only for already-supported Maven signal fields
The parser will continue to recognize the same Maven fields it recognizes today, but it will resolve `${...}` references before calling version parsing. This keeps the capability focused on closing the current gap rather than changing the product contract to cover all Maven metadata.

**Alternatives considered:**
- Expand support to more plugins or Maven concepts now. Rejected because it increases scope and makes the first change harder to verify.
- Leave interpolation to callers. Rejected because callers do not have enough Maven structure to do this correctly.

### 2. Use a bounded property resolver instead of full Maven interpolation
Introduce a helper that resolves property references from a merged property map, follows chained references, and stops on unresolved references or cycles. The resolver should be intentionally narrow: string-to-string interpolation for supported property names, with a maximum depth or visited-set cycle check.

**Alternatives considered:**
- Implement full Maven interpolation semantics. Rejected as too complex for the current parser and unnecessary for the target use case.
- Resolve only one level of `${...}`. Rejected because chained property indirection is common and easy to support safely.

### 3. Merge child and local-parent properties for module parsing
When parsing a pom with a local parent, build a property map where child properties override parent properties, then resolve supported fields against that map. This matches common Maven usage where a module references `${java.version}` defined in the parent. Parent-origin signals should still be emitted separately when the parent contains supported fields of its own.

**Alternatives considered:**
- Resolve each pom in complete isolation. Rejected because module poms often rely on inherited properties.
- Walk grandparents or remote parents. Rejected to keep the existing bounded local-parent behavior unchanged.

### 4. Treat unresolved or cyclic references as no signal for that field, not as hard errors
If a supported field references an unknown property or a cycle is detected, that field will be ignored and parsing will continue. This preserves the current fail-soft parsing style while avoiding false positives.

**Alternatives considered:**
- Throw on unresolved references. Rejected because the current parser is intentionally tolerant and should continue to return the best available signal set.

## Risks / Trade-offs

- **Property inheritance is only partially modeled** → Keep scope explicit: support local parent property maps, not full effective POM semantics.
- **Interpolation can accidentally over-match non-version text** → Run `parseMajor` only after bounded interpolation and keep existing numeric extraction rules.
- **Cycles or long chains could create parser complexity** → Use a visited-set and fixed depth bound, and test cycle/unresolved cases explicitly.
- **Behavior changes may surface new conflicts** → Add tests for projects where interpolated fields resolve to conflicting majors so conflict behavior stays predictable.
