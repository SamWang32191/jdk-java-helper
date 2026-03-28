import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as childProcess from 'node:child_process'

function listHomesFromDirectoryNames(root: string, names: string[]): string[] {
  return names.map((name) => path.join(root, name, 'Contents', 'Home'))
}

export function parseJavaHomeVersionList(output: string): string[] {
  const homes: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const quoted = line.match(/"([^"]+\/Contents\/Home)"/)
    if (quoted) {
      homes.push(quoted[1])
      continue
    }

    const plain = line.match(/(\/[^\s]+\/Contents\/Home)$/)
    if (plain) {
      homes.push(plain[1])
    }
  }

  return homes
}

export interface DiscoverMacosOptions {
  commandRunner?: { spawnSync?: typeof childProcess.spawnSync }
  directoryListings?: Record<string, string[]>
}

async function readBundleNames(root: string, directoryListings?: Record<string, string[]>): Promise<string[]> {
  if (directoryListings && root in directoryListings) {
    return directoryListings[root]
  }

  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

export async function discoverMacosJdkHomes(options: DiscoverMacosOptions = {}): Promise<string[]> {
  const roots = [
    '/Library/Java/JavaVirtualMachines',
    path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'),
  ]

  const homes = new Set<string>()
  const spawnSync = options.commandRunner?.spawnSync ?? childProcess.spawnSync
  const result = spawnSync('/usr/libexec/java_home', ['-V'], { encoding: 'utf8' })
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  for (const home of parseJavaHomeVersionList(output)) {
    homes.add(home)
  }

  for (const root of roots) {
    const bundles = await readBundleNames(root, options.directoryListings)
    for (const home of listHomesFromDirectoryNames(root, bundles)) {
      homes.add(home)
    }
  }

  return [...homes]
}
