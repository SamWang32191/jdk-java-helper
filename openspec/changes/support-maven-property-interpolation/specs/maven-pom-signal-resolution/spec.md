## ADDED Requirements

### Requirement: Resolve supported Maven property references in the same pom
The system SHALL resolve `${...}` property references before extracting Java major versions from supported Maven signal fields in the current `pom.xml`. Supported fields remain limited to `maven.compiler.release`, `maven.compiler.source`, `maven.compiler.target`, and `maven-compiler-plugin` `release`, `source`, and `target`.

#### Scenario: Property-backed compiler properties resolve to a Java major
- **WHEN** a `pom.xml` defines `<java.version>21</java.version>` and a supported field such as `<maven.compiler.release>${java.version}</maven.compiler.release>`
- **THEN** Maven signal parsing produces a Java 21 signal instead of returning no signal for that field

#### Scenario: Chained property references are resolved within bounded limits
- **WHEN** a supported field references a property that references another property before ending in a literal Java version
- **THEN** Maven signal parsing resolves the chain and produces the final Java major if the chain terminates successfully

### Requirement: Resolve supported Maven signal fields with local parent property inheritance
The system SHALL resolve supported Maven signal fields in a child `pom.xml` using properties inherited from a declared local parent pom that is reachable through the existing local parent lookup rules.

#### Scenario: Child plugin configuration references a parent-defined java version
- **WHEN** a module `pom.xml` declares `<source>${java.version}</source>` or `<target>${java.version}</target>` in `maven-compiler-plugin` and the declared local parent defines `<java.version>21</java.version>`
- **THEN** Maven signal parsing produces Java 21 signals for the child module instead of ignoring those fields

#### Scenario: Default Maven parent relative path still enables inherited property resolution
- **WHEN** a child `pom.xml` omits `<relativePath>` and the default `../pom.xml` parent defines properties used by supported Maven signal fields
- **THEN** Maven signal parsing resolves those inherited property references using the local parent pom

### Requirement: Ignore unsupported, unresolved, or cyclic Maven property references safely
The system SHALL treat unsupported, unresolved, or cyclic Maven property references as non-signals for the affected field while continuing to parse other supported Maven signal fields.

#### Scenario: Unresolved property reference does not create a false signal
- **WHEN** a supported Maven signal field references a property that cannot be resolved from the current pom or its supported local parent context
- **THEN** Maven signal parsing does not emit a Java version for that field and does not raise a hard parsing error

#### Scenario: Cyclic property reference does not loop indefinitely
- **WHEN** supported Maven signal fields depend on a cycle of `${...}` property references
- **THEN** Maven signal parsing stops resolution for the affected field without hanging and continues evaluating remaining supported fields
