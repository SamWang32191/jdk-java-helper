---
id: npm-pack-needs-package-local-license
date: 2026-04-02
scope: project
tags: [npm, publishing, packaging, license]
source: bug-fix
confidence: 0.5
related: [[workspace-package-tests-need-local-vitest-config]]
---

# npm pack needs a package-local LICENSE

## Context

While validating npm publish readiness for workspace packages, the repository had a root `LICENSE` file and package manifests declared `"license": "MIT"`.

## Mistake

I assumed that was enough for the packed npm artifacts, but `npm pack --json` showed the tarballs for public workspace packages did not include any `LICENSE` file.

## Lesson

For publishable workspace packages, put a `LICENSE` file in each package root if the published tarball must include license text. A repo-root license plus a manifest `license` field does not guarantee the package tarball carries the license file.

## When to Apply

Use this when preparing npm packages inside a monorepo or workspace, especially when validating packed output before first publication.
