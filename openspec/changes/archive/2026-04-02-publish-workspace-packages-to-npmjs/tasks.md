## 1. Define package publishability boundaries

- [x] 1.1 Add the repository licensing artifact and align shared package metadata expectations for publishable workspace packages.
- [x] 1.2 Update `packages/core/package.json` to satisfy the publishability contract, including public publish settings, packed-file boundaries, and publish-time validation hooks.
- [x] 1.3 Update `packages/opencode-plugin/package.json` to satisfy the publishability contract, including public publish settings, packed-file boundaries, and publish-time validation hooks.
- [x] 1.4 Decide whether `packages/claude-plugin` is release-ready; either complete its npm package surface and packaged assets or explicitly gate it from publication.

## 2. Implement coordinated release validation and publish flow

- [x] 2.1 Add package-level build, test, and `npm pack` validation commands for every package in the release set.
- [x] 2.2 Add root-level release orchestration scripts that enforce the documented publish order for workspace packages with internal dependencies.
- [x] 2.3 Ensure the release workflow preserves the repository's coordinated versioning policy for published workspace packages.

## 3. Update maintainer and consumer documentation

- [x] 3.1 Update the root README with the npmjs publishing workflow, release prerequisites, and the supported public package list.
- [x] 3.2 Update package-level READMEs and related docs so each public package documents installation, usage, and any version-sensitive caveats.

## 4. Verify release readiness

- [x] 4.1 Run repository build and relevant automated tests after the publishability changes land.
- [x] 4.2 Run packed-output validation for each package in the release set and confirm the published contents match the documented contract.
- [x] 4.3 Rehearse the ordered npm publish flow in dry-run form and capture any follow-up fixes before the first real release.
