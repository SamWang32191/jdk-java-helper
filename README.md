# jdk-auto-switch

Shared core plus OpenCode and Claude Code adapters for command-scoped JDK switching in Maven projects.

## Packages

- `@jdk-auto-switch/core` — resolver, diagnostics, CLI
- `@jdk-auto-switch/opencode-plugin` — OpenCode adapter
- `@jdk-auto-switch/claude-plugin` — Claude Code hook package

## OpenCode plugin usage

Install the package:

```bash
npm install @jdk-auto-switch/opencode-plugin
```

Add it to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@jdk-auto-switch/opencode-plugin"]
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
