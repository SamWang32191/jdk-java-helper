import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const publishOrder = ['packages/core', 'packages/opencode-plugin']

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run(process.execPath, ['./scripts/release-version-check.mjs'])

for (const workspace of publishOrder) {
  const args = ['publish', '--workspace', workspace, '--access', 'public']
  if (dryRun) {
    args.push('--dry-run')
  }

  console.log(`\n==> ${dryRun ? 'Dry-run publishing' : 'Publishing'} ${workspace}`)
  run('npm', args)
}
