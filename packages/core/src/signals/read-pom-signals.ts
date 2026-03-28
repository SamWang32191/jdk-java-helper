import { promises as fs } from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type { VersionSignal } from '../types.js'

const parser = new XMLParser({ ignoreAttributes: false })

function parseMajor(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = value.trim().match(/(?:^|\D)(1\.(\d{1,2})|(\d{1,2}))(?:\D|$)/)
  if (!match) {
    return null
  }

  return Number(match[2] ?? match[3])
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function readSignalsFromPom(pom: unknown, detailPrefix = ''): VersionSignal[] {
  if (!pom || typeof pom !== 'object') {
    return []
  }

  const project = pom as {
    properties?: Record<string, unknown>
    build?: {
      plugins?: {
        plugin?: Array<{ artifactId?: unknown; configuration?: Record<string, unknown> }> | { artifactId?: unknown; configuration?: Record<string, unknown> }
      }
      pluginManagement?: {
        plugins?: {
          plugin?: Array<{ artifactId?: unknown; configuration?: Record<string, unknown> }> | { artifactId?: unknown; configuration?: Record<string, unknown> }
        }
      }
    }
  }

  const signals: VersionSignal[] = []
  const propertySignals = [
    ['maven.compiler.release', 'maven.compiler.release'],
    ['maven.compiler.source', 'maven.compiler.source'],
    ['maven.compiler.target', 'maven.compiler.target'],
  ] as const

  for (const [propertyName, detail] of propertySignals) {
    const major = parseMajor(project.properties?.[propertyName])
    if (major !== null) {
      signals.push({ major, source: 'maven', detail: `${detailPrefix}${detail}` })
    }
  }

  const pluginSections = [project.build?.plugins?.plugin, project.build?.pluginManagement?.plugins?.plugin]
  for (const section of pluginSections) {
    for (const plugin of asArray(section)) {
      if (plugin.artifactId !== 'maven-compiler-plugin') {
        continue
      }

      const release = parseMajor(plugin.configuration?.release)
      if (release !== null) {
        signals.push({ major: release, source: 'maven', detail: `${detailPrefix}maven-compiler-plugin:release` })
      }

      const source = parseMajor(plugin.configuration?.source)
      if (source !== null) {
        signals.push({ major: source, source: 'maven', detail: `${detailPrefix}maven-compiler-plugin:source` })
      }

      const target = parseMajor(plugin.configuration?.target)
      if (target !== null) {
        signals.push({ major: target, source: 'maven', detail: `${detailPrefix}maven-compiler-plugin:target` })
      }
    }
  }

  return signals
}

async function readPomObject(pomPath: string): Promise<unknown> {
  const xml = await fs.readFile(pomPath, 'utf8')
  return parser.parse(xml).project
}

export async function readPomSignals(projectRoot: string): Promise<VersionSignal[]> {
  const pomPath = path.join(projectRoot, 'pom.xml')
  const project = await readPomObject(pomPath)

  const signals = readSignalsFromPom(project)

  if (!project || typeof project !== 'object') {
    return signals
  }

  const parent = (project as { parent?: { relativePath?: unknown } }).parent
  if (!parent) {
    return signals
  }

  const parentRelativePath = parent.relativePath
  if (parentRelativePath === '') {
    return signals
  }

  const resolvedParentRelativePath = typeof parentRelativePath === 'string' ? parentRelativePath.trim() : '../pom.xml'
  if (resolvedParentRelativePath.length === 0) {
    return signals
  }

  const parentPomPath = path.resolve(projectRoot, resolvedParentRelativePath)
  try {
    const parentStat = await fs.stat(parentPomPath)
    const resolvedParentPomPath = parentStat.isDirectory() ? path.join(parentPomPath, 'pom.xml') : parentPomPath
    const parent = await readPomObject(resolvedParentPomPath)
    signals.push(...readSignalsFromPom(parent, 'parent:'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  return signals
}
