# @jdk-auto-switch/core

Core JDK resolution library and CLI for Maven-aware command execution.

## Install

```bash
npm install @jdk-auto-switch/core
```

## CLI usage

```bash
npx jdk-auto-switch explain --cwd /path/to/project --command "mvn test"
```

## Library usage

```ts
import { resolveJdk } from '@jdk-auto-switch/core'

const result = await resolveJdk({
  cwd: '/path/to/project',
  command: 'mvn test',
  platform: process.platform,
  env: process.env,
})
```

## Notes

- The current public API is focused on Maven project detection and JDK selection.
- CLI output is intended for local diagnostics and may evolve with the resolver's diagnostics model.
