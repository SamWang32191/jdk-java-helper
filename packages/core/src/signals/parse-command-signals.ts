import type { VersionSignal } from '../types.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseMajor(value: string): number | null {
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

export function parseCommandSignals(command: string): VersionSignal[] {
  const signals: VersionSignal[] = []

  const makeJava = command.match(/^make(?:\s+[^\s=]+)*\s+JAVA=([^\s]+)(?:\s|$)/)
  if (makeJava) {
    const major = parseMajor(makeJava[1])
    if (major !== null) {
      signals.push({ major, source: 'command', detail: `make JAVA=${makeJava[1]}` })
    }
  }

  const propertyPatterns = ['java.version', 'maven.compiler.release']
  for (const propertyName of propertyPatterns) {
    const regex = new RegExp(`-D${escapeRegExp(propertyName)}=([^\\s]+)`, 'g')
    for (const match of command.matchAll(regex)) {
      const major = parseMajor(match[1])
      if (major === null) {
        continue
      }
      signals.push({
        major,
        source: 'command',
        detail: `-D${propertyName}=${match[1]}`,
      })
    }
  }

  return signals
}
