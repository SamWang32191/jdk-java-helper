import { pathToFileURL } from 'node:url'

import { formatExplain } from './diagnostics/format-explain.js'
import { resolveJdk } from './resolver/resolve-jdk.js'

interface CliDeps {
  resolve: typeof resolveJdk
}

interface CliIo {
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
}

function readFlag(argv: string[], name: '--cwd' | '--command'): string | undefined {
  const index = argv.indexOf(name)
  if (index === -1) {
    return undefined
  }

  return argv[index + 1]
}

export async function runCli(argv: string[], deps: CliDeps = { resolve: resolveJdk }): Promise<string> {
  const commandName = argv[0]
  if (commandName !== 'explain') {
    return 'Usage: jdk-auto-switch explain --cwd <path> --command <shell-command>'
  }

  const cwd = readFlag(argv, '--cwd') ?? process.cwd()
  const command = readFlag(argv, '--command') ?? ''
  const result = await deps.resolve({ cwd, command, platform: process.platform, env: process.env })
  return formatExplain(result)
}

export async function runCliMain(
  argv: string[],
  io: CliIo = {
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
  },
  deps: CliDeps = { resolve: resolveJdk },
): Promise<number> {
  try {
    const output = await runCli(argv, deps)
    io.stdout(`${output}\n`)
    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.stderr(`${message}\n`)
    return 1
  }
}

const invokedAsCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedAsCli) {
  const exitCode = await runCliMain(process.argv.slice(2))
  process.exit(exitCode)
}
