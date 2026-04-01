import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as childProcess from 'node:child_process'

const DEFAULT_ROOTS = [
  'C:\\Program Files\\Java',
  'C:\\Program Files\\Eclipse Adoptium',
  'C:\\Program Files\\Amazon Corretto',
  'C:\\Program Files\\Microsoft',
  'C:\\Program Files (x86)\\Java',
]

export function parseWindowsRegistryJavaHomes(output: string): string[] {
  const homes: string[] = []
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*JavaHome\s+REG_SZ\s+(.+)$/i)
    if (match) {
      homes.push(match[1].trim())
    }
  }

  return homes
}

export interface DiscoverWindowsOptions {
  commandRunner?: { spawnSync?: typeof childProcess.spawnSync }
  directoryListings?: Record<string, string[]>
}

async function readInstallations(root: string, directoryListings?: Record<string, string[]>): Promise<string[]> {
  if (directoryListings && root in directoryListings) {
    return directoryListings[root].map((name) => path.win32.join(root, name))
  }

  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.win32.join(root, entry.name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

function readRegistryHomes(spawnSync: typeof childProcess.spawnSync): string[] {
  const registryRoots = [
    'HKLM\\SOFTWARE\\JavaSoft\\JDK',
    'HKLM\\SOFTWARE\\WOW6432Node\\JavaSoft\\JDK',
  ]

  const homes = new Set<string>()
  for (const root of registryRoots) {
    const result = spawnSync('reg', ['query', root, '/s'], { encoding: 'utf8' })
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    for (const home of parseWindowsRegistryJavaHomes(output)) {
      homes.add(home)
    }
  }

  return [...homes]
}

export async function discoverWindowsJdkHomes(options: DiscoverWindowsOptions = {}): Promise<string[]> {
  const homes = new Set<string>()
  const spawnSync = options.commandRunner?.spawnSync ?? childProcess.spawnSync

  for (const home of readRegistryHomes(spawnSync)) {
    homes.add(home)
  }

  for (const root of DEFAULT_ROOTS) {
    for (const installation of await readInstallations(root, options.directoryListings)) {
      homes.add(installation)
    }
  }

  return [...homes]
}
