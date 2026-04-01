import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { VersionSignal } from '../types.js'

function extractMajor(value: string): number | null {
  for (const segment of value.trim().split('-')) {
    const legacyMatch = segment.match(/^1\.(\d{1,2})(?:\D|$)/)
    if (legacyMatch) {
      return Number(legacyMatch[1])
    }

    const match = segment.match(/^(\d{1,2})(?:\.\d+)*(?:[+_].*)?$/)
    if (match) {
      return Number(match[1])
    }
  }

  return null
}

export async function readVersionFiles(projectRoot: string): Promise<VersionSignal[]> {
  const signals: VersionSignal[] = []

  const javaVersionPath = path.join(projectRoot, '.java-version')
  const toolVersionsPath = path.join(projectRoot, '.tool-versions')
  const sdkmanrcPath = path.join(projectRoot, '.sdkmanrc')

  try {
    const contents = await fs.readFile(javaVersionPath, 'utf8')
    const major = extractMajor(contents.trim())
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.java-version' })
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  try {
    const contents = await fs.readFile(toolVersionsPath, 'utf8')
    const javaLine = contents
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('java '))
    const major = javaLine ? extractMajor(javaLine.trim().slice('java '.length)) : null
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.tool-versions' })
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  try {
    const contents = await fs.readFile(sdkmanrcPath, 'utf8')
    const javaLine = contents
      .split(/\r?\n/)
      .find((line) => line.trim().startsWith('java='))
    const major = javaLine ? extractMajor(javaLine.trim().slice('java='.length)) : null
    if (major !== null) {
      signals.push({ major, source: 'version-file', detail: '.sdkmanrc' })
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  return signals
}
