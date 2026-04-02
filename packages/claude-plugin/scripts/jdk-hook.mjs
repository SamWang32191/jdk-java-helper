import { resolveJdk as coreResolveJdk } from '@w32191/jdk-auto-switch-core'

function normalizeCommand(payload) {
  return payload?.tool_input?.command ?? payload?.command ?? ''
}

function normalizeCwd(payload) {
  return payload?.tool_input?.cwd ?? payload?.cwd ?? process.cwd()
}

function createResolveInput(payload) {
  return {
    cwd: normalizeCwd(payload),
    command: normalizeCommand(payload),
    platform: process.platform,
    env: process.env,
  }
}

function formatExports(env) {
  return Object.entries(env).map(([key, value]) => `export ${key}=${JSON.stringify(value)}`)
}

export async function runHook(payload, resolver = { resolve: coreResolveJdk }) {
  const result = await resolver.resolve(createResolveInput(payload))

  if (result.kind === 'resolved') {
    return {
      exitCode: 0,
      stdout: formatExports(result.env).join('\n'),
    }
  }

  if (result.code !== 'NO_PROJECT') {
    return {
      exitCode: 2,
      stdout: result.reasons.join('\n'),
    }
  }

  return {
    exitCode: 0,
    stdout: '',
  }
}

if (process.argv[1] && process.argv[1].endsWith('jdk-hook.mjs')) {
  let raw = ''
  for await (const chunk of process.stdin) {
    raw += chunk
  }
  const payload = raw.length > 0 ? JSON.parse(raw) : {}
  const result = await runHook(payload)
  process.stdout.write(result.stdout)
  process.exit(result.exitCode)
}
