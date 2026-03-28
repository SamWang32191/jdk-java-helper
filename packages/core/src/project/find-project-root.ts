import { promises as fs } from 'node:fs'
import path from 'node:path'

async function hasPomXml(directory: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(directory, 'pom.xml'))
    return stat.isFile()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }

    throw error
  }
}

export async function findProjectRoot(cwd: string): Promise<string | null> {
  let current = path.resolve(cwd)

  while (true) {
    if (await hasPomXml(current)) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}
