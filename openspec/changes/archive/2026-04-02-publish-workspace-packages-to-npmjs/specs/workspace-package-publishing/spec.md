## ADDED Requirements

### Requirement: Publishable workspace packages declare complete npm package contracts
The system SHALL require every workspace package intended for npmjs publication to declare an explicit npm package contract, including package identity metadata, runtime entry metadata, public access metadata for scoped packages, and an explicit packed-file boundary that matches the files needed after installation.

#### Scenario: Publishable package manifest is release-ready
- **WHEN** a maintainer inspects a workspace package that is marked publishable
- **THEN** its manifest defines the metadata and entrypoints needed for npm consumers, and its packed contents are limited to the files required at runtime and for package documentation

#### Scenario: Package with non-code runtime assets remains installable after publish
- **WHEN** a publishable package depends on runtime assets outside compiled JavaScript output, such as plugin manifests or hook configuration files
- **THEN** those assets are included in the package contract and remain available at stable install-time paths after npm installation

#### Scenario: Incomplete package cannot publish accidentally
- **WHEN** a workspace package does not yet satisfy the publishability contract
- **THEN** the release workflow excludes it from publication until the missing metadata, entrypoints, or packaged assets are completed

### Requirement: Publish workflow validates build, tests, and packed output before upload
The system SHALL require publishable workspace packages to pass release validation before npm upload, including package-scoped build execution, relevant automated tests, and a packed-output validation step that reflects the contents consumers would receive.

#### Scenario: Successful validation proves publishable output
- **WHEN** a maintainer runs the release validation command for a publishable package
- **THEN** the package is built, its required tests pass, and packed-output validation succeeds against the exact files intended for npm publication

#### Scenario: Validation failure blocks publication
- **WHEN** build, test, or packed-output validation fails for a package in the release set
- **THEN** npm publication stops before any failing package is uploaded

### Requirement: Workspace releases use coordinated versioning and dependency-safe publish order
The system SHALL define a coordinated multi-package npm release model for publishable workspace packages, including a documented versioning policy and a dependency-safe publish order for packages with internal workspace dependencies.

#### Scenario: Core publishes before dependent adapter packages
- **WHEN** a release includes `@jdk-auto-switch/core` and one or more packages that depend on it
- **THEN** the release workflow publishes `@jdk-auto-switch/core` before publishing its dependent packages

#### Scenario: Release version stays coherent across published workspace packages
- **WHEN** maintainers prepare a coordinated workspace release
- **THEN** all packages included in that release use the documented shared versioning policy so internal dependency references remain valid after publication

### Requirement: Repository documentation defines maintainer and consumer npm workflows
The system SHALL document how maintainers validate and publish workspace packages to npmjs and how consumers install and use each package that is designated as public.

#### Scenario: Maintainer follows documented release flow
- **WHEN** a maintainer follows the documented npm release steps
- **THEN** they can authenticate, validate, publish, and verify the intended workspace packages without relying on undocumented tribal knowledge

#### Scenario: Consumer-facing packages document installation and usage
- **WHEN** a package is designated as public on npmjs
- **THEN** its README or equivalent package documentation explains how to install it and how to use its public runtime entrypoints after installation
