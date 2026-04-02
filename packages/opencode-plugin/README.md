# @jdk-auto-switch/opencode-plugin

OpenCode plugin for command-scoped JDK switching in Maven projects.

## Install

```bash
npm install @jdk-auto-switch/opencode-plugin
```

## Configure `opencode.json`

Add the package to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@jdk-auto-switch/opencode-plugin"]
}
```

## Verify plugin loading

```bash
opencode --print-logs --log-level DEBUG session list --format json
```

Success means there is no plugin loader or target-discovery error in the logs.

## Verify Maven project JDK switching

Run a command through OpenCode inside a Maven project that requires a specific JDK, then confirm `JAVA_HOME` / `PATH` switch to the JDK required by that project.

## Notes

- The loader contract is sensitive to the OpenCode version, so validate plugin loading against the target release.
- If your OpenCode setup still needs an explicit entry-file export path, use this as an advanced fallback:

```ts
import jdkAutoSwitch from '@jdk-auto-switch/opencode-plugin'

export default jdkAutoSwitch
```

## What it does

Advanced hook details: the plugin uses OpenCode hooks to inject `JAVA_HOME` / `PATH` and to validate or rewrite Bash commands before execution.

- Injects `JAVA_HOME` and `PATH` through OpenCode's `shell.env` hook.
- Checks Bash executions through `tool.execute.before`.
- Rewrites Bash commands with resolved JDK environment variables when a Maven project requires a matching JDK.
- Blocks Bash execution with an actionable error when the project is recognized but the required JDK is unavailable.
