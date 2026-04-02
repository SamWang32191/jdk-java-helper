# jdk-auto-switch

Shared core plus OpenCode and Claude Code adapters for command-scoped JDK switching in Maven projects.

## Packages

- `@w32191/jdk-auto-switch-core` — public npm package for resolver logic, diagnostics, and CLI
- `@w32191/jdk-auto-switch-opencode-plugin` — public npm package for the OpenCode adapter
- `@w32191/jdk-auto-switch-claude-plugin` — internal package, gated from npm publication until its package contract is finished

## npm release workflow

Authenticate with npm first:

```bash
npm whoami
```

Validate the release set:

```bash
npm install
npm run release:check
```

Rehearse the ordered publish flow without uploading:

```bash
npm run release:publish:dry-run
```

Publish the public packages in dependency order:

```bash
npm run release:publish
```

Current public release set:

- `@w32191/jdk-auto-switch-core`
- `@w32191/jdk-auto-switch-opencode-plugin`

## OpenCode plugin usage

Install the package:

```bash
npm install @w32191/jdk-auto-switch-opencode-plugin
```

Add it to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@w32191/jdk-auto-switch-opencode-plugin"]
}
```

Verify the plugin loads:

```bash
opencode --print-logs --log-level DEBUG session list --format json
```

Success means there is no plugin loader or target-discovery error in the logs, and Maven commands executed through OpenCode switch `JAVA_HOME` / `PATH` to the required JDK inside the project.

> Note: the loader contract is sensitive to the OpenCode version; verify plugin loading against the target OpenCode release.

## Development

```bash
npm install
npm test
npm run build
```

## Example CLI usage

```bash
npx jdk-auto-switch explain --cwd /path/to/project --command "make JAVA=17 test"
```
