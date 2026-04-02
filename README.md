# jdk-auto-switch

Shared core plus OpenCode and Claude Code adapters for command-scoped JDK switching in Maven projects.

## Packages

- `@jdk-auto-switch/core` — resolver, diagnostics, CLI
- `@jdk-auto-switch/opencode-plugin` — OpenCode adapter
- `@jdk-auto-switch/claude-plugin` — Claude Code hook package

## OpenCode plugin usage

Install the package in the OpenCode plugin project that will host it:

```bash
npm install @jdk-auto-switch/opencode-plugin
```

Then export it from your OpenCode plugin entry:

```ts
import jdkAutoSwitch from '@jdk-auto-switch/opencode-plugin'

export default jdkAutoSwitch
```

The plugin uses `shell.env` to inject `JAVA_HOME` and `PATH` for Maven projects, and uses `tool.execute.before` to validate or rewrite Bash commands before execution.

To verify the integration, run a Bash command inside a Maven project that requires a specific JDK and confirm the command sees the expected `JAVA_HOME`.

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
