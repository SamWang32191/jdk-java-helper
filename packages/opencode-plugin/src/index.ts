import type { ResolveInput, ResolveResult } from '@jdk-auto-switch/core'

export interface OpenCodeShellEnvInput {
  cwd: string
  sessionID?: string
  callID?: string
}

export interface OpenCodeShellEnvOutput {
  env: Record<string, string>
}

export interface OpenCodeToolExecuteBeforeInput {
  tool: string
  sessionID: string
  callID: string
}

export interface OpenCodeToolExecuteBeforeOutput {
  args: unknown
}

export interface OpenCodeHooks {
  'shell.env': (
    input: OpenCodeShellEnvInput,
    output: OpenCodeShellEnvOutput,
  ) => Promise<void>
  'tool.execute.before': (
    input: OpenCodeToolExecuteBeforeInput,
    output: OpenCodeToolExecuteBeforeOutput,
  ) => Promise<void>
}

export interface OpenCodePluginDependencies {
  resolveJdk?: (input: ResolveInput) => Promise<ResolveResult>
  env?: NodeJS.ProcessEnv
}

type OpenCodePluginOptions = Record<string, unknown>

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
    async 'shell.env'(input, output) {
      const result = await resolveJdk(createResolveInput(input.cwd, '', runtimeEnv))

      if (result.kind !== 'resolved') {
        return
      }

      output.env = {
        ...output.env,
        ...result.env,
      }
    },
    async 'tool.execute.before'(input, output) {
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

async function opencodePlugin(_input: unknown, _options?: OpenCodePluginOptions): Promise<OpenCodeHooks> {
  return createOpenCodePlugin()
}

export default opencodePlugin
