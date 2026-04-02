import type { ResolveInput, ResolveResult } from '@jdk-auto-switch/core'
import type { Hooks, Plugin, PluginModule } from '@opencode-ai/plugin'

type OpenCodeHooks = Pick<Hooks, 'shell.env' | 'tool.execute.before'>
type ShellEnvHook = NonNullable<Hooks['shell.env']>
type ToolExecuteBeforeHook = NonNullable<Hooks['tool.execute.before']>

export interface OpenCodePluginDependencies {
  resolveJdk?: (input: ResolveInput) => Promise<ResolveResult>
  env?: NodeJS.ProcessEnv
}

function createResolveInput(cwd: string, command: string, env: NodeJS.ProcessEnv): ResolveInput {
  return {
    cwd,
    command,
    platform: process.platform,
    env,
  }
}

function isAllowedUnresolved(code: string): boolean {
  return code === 'NO_PROJECT'
}

function createResolutionError(result: Extract<ResolveResult, { kind: 'unresolved' }>): Error {
  const reasons = result.reasons.length > 0 ? `: ${result.reasons.join(' ')}` : ''
  return new Error(`JDK resolution failed (${result.code})${reasons}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readBashCommand(args: unknown): string | null {
  if (!isRecord(args) || typeof args.command !== 'string') {
    return null
  }

  return args.command
}

function readBashWorkdir(args: unknown): string | null {
  if (!isRecord(args) || typeof args.workdir !== 'string') {
    return null
  }

  return args.workdir
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function wrapCommandWithResolvedEnv(command: string, env: Record<string, string>): string {
  const envExports = Object.entries(env)
    .map(([key, value]) => `export ${key}=${shellEscape(value)}`)
    .join('; ')

  if (!envExports) {
    return command
  }

  return `${envExports}; ${command}`
}

async function defaultResolveJdk(input: ResolveInput): Promise<ResolveResult> {
  const { resolveJdk } = await import('@jdk-auto-switch/core')
  return resolveJdk(input)
}

export function createOpenCodePlugin(dependencies: OpenCodePluginDependencies = {}): OpenCodeHooks {
  const resolveJdk = dependencies.resolveJdk ?? defaultResolveJdk
  const runtimeEnv = dependencies.env ?? process.env

  return {
    async 'shell.env'(input: Parameters<ShellEnvHook>[0], output: Parameters<ShellEnvHook>[1]) {
      const result = await resolveJdk(createResolveInput(input.cwd, '', runtimeEnv))

      if (result.kind !== 'resolved') {
        return
      }

      output.env = {
        ...output.env,
        ...result.env,
      }
    },
    async 'tool.execute.before'(
      input: Parameters<ToolExecuteBeforeHook>[0],
      output: Parameters<ToolExecuteBeforeHook>[1],
    ) {
      if (input.tool !== 'bash') {
        return
      }

      const command = readBashCommand(output.args)
      if (!command) {
        return
      }

      const cwd = readBashWorkdir(output.args) ?? process.cwd()
      const result = await resolveJdk(createResolveInput(cwd, command, runtimeEnv))

      if (result.kind === 'resolved') {
        if (isRecord(output.args)) {
          output.args.command = wrapCommandWithResolvedEnv(command, result.env)
        }
        return
      }

      if (isAllowedUnresolved(result.code)) {
        return
      }

      throw createResolutionError(result)
    },
  }
}

export const server: Plugin = async (_input, _options) => createOpenCodePlugin()

const pluginModule: PluginModule = {
  server,
}

export default pluginModule
