import { resolveJdk as coreResolveJdk } from '@jdk-auto-switch/core'
import type { ResolveInput, ResolveResult } from '@jdk-auto-switch/core'

export interface OpenCodeExecutionContext {
  cwd: string
  command: string
  env: NodeJS.ProcessEnv
  tool: string
}

export interface OpenCodeShellEnvInput extends OpenCodeExecutionContext {}

export interface OpenCodeShellEnvOutput {
  env: Record<string, string>
}

export interface OpenCodeShellEnvHook {
  (input: OpenCodeShellEnvInput, output: OpenCodeShellEnvOutput): Promise<Record<string, string>>
}

export interface OpenCodeToolExecuteBeforeInput extends OpenCodeExecutionContext {}

export interface OpenCodeToolExecuteBeforeOutput {
  env: Record<string, string>
}

export interface OpenCodePlugin {
  'shell.env': OpenCodeShellEnvHook
  'tool.execute.before': (
    input: OpenCodeToolExecuteBeforeInput,
    output: OpenCodeToolExecuteBeforeOutput,
  ) => Promise<OpenCodeToolExecuteBeforeOutput>
}

export interface OpenCodePluginDependencies {
  resolveJdk?: (input: ResolveInput) => Promise<ResolveResult>
}

function normalizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const cleanEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      cleanEnv[key] = value
    }
  }

  return cleanEnv
}

function createResolveInput(context: OpenCodeExecutionContext): ResolveInput {
  return {
    cwd: context.cwd,
    command: context.command,
    platform: process.platform,
    env: context.env,
  }
}

function isShellTool(tool: string): boolean {
  return tool === 'shell' || tool === 'bash'
}

function isAllowedUnresolved(code: string): boolean {
  return code === 'NO_PROJECT'
}

function createResolutionError(result: Extract<ResolveResult, { kind: 'unresolved' }>): Error {
  const reasons = result.reasons.length > 0 ? `: ${result.reasons.join(' ')}` : ''
  return new Error(`JDK resolution failed (${result.code})${reasons}`)
}

export function createOpenCodePlugin(dependencies: OpenCodePluginDependencies = {}): OpenCodePlugin {
  const resolveJdk = dependencies.resolveJdk ?? coreResolveJdk

  return {
    async 'shell.env'(input, output) {
      const result = await resolveJdk(createResolveInput(input))

      if (result.kind === 'resolved') {
        return result.env
      }

      return normalizeEnv(output.env)
    },
    async 'tool.execute.before'(input, output) {
      if (!isShellTool(input.tool)) {
        return output
      }

      const result = await resolveJdk(createResolveInput(input))

      if (result.kind === 'resolved') {
        return {
          env: result.env,
        }
      }

      if (isAllowedUnresolved(result.code)) {
        return output
      }

      throw createResolutionError(result)
    },
  }
}

export const opencodePlugin = createOpenCodePlugin()

export default opencodePlugin
