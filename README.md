# jdk-auto-switch

Shared core plus OpenCode and Claude Code adapters for command-scoped JDK switching in Maven projects.

## Packages

- `@jdk-auto-switch/core` — resolver, diagnostics, CLI
- `@jdk-auto-switch/opencode-plugin` — OpenCode adapter
- `@jdk-auto-switch/claude-plugin` — Claude Code hook package

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
