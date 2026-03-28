import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { JdkHomeDiscovery } from '../types.js'

export interface DiscoverManagerOptions {
  directoryListings?: Record<string, string[]>
}

async function readInstallations(root: string, directoryListings?: Record<string, string[]>): Promise<string[]> {
  if (directoryListings && root in directoryListings) {
    return directoryListings[root].map((name) => path.join(root, name))
  }

  try {
    const entries = await fs.readdir(root, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }
}

export async function discoverManagerHomes(homeDir: string, options: DiscoverManagerOptions = {}): Promise<JdkHomeDiscovery[]> {
  const sources = [
    { root: path.join(homeDir, '.sdkman', 'candidates', 'java'), source: 'sdkman' as const },
    { root: path.join(homeDir, '.asdf', 'installs', 'java'), source: 'asdf' as const },
    { root: path.join(homeDir, '.local', 'share', 'mise', 'installs', 'java'), source: 'mise' as const },
  ]

  const homes: JdkHomeDiscovery[] = []
  for (const bucket of sources) {
    for (const home of await readInstallations(bucket.root, options.directoryListings)) {
      homes.push({ home, source: bucket.source })
    }
  }

  return homes
}
