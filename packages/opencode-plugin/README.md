# @jdk-auto-switch/opencode-plugin

OpenCode plugin for command-scoped JDK switching in Maven projects.

## Install

```bash
npm install @jdk-auto-switch/opencode-plugin
```

## Usage

Export the plugin from your OpenCode plugin entry or config file:

```ts
import jdkAutoSwitch from '@jdk-auto-switch/opencode-plugin'

export default jdkAutoSwitch
```

## What it does

- Injects `JAVA_HOME` and `PATH` through OpenCode's `shell.env` hook.
- Checks Bash executions through `tool.execute.before`.
- Rewrites Bash commands with resolved JDK environment variables when a Maven project requires a matching JDK.
- Blocks Bash execution with an actionable error when the project is recognized but the required JDK is unavailable.

## Verify

Run a Bash command in a Maven project that requires a specific JDK, for example:

```bash
mvn test
```

Then confirm the command runs with the expected `JAVA_HOME` for that project.
