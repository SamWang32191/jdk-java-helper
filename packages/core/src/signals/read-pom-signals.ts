import { promises as fs } from 'node:fs'
import path from 'node:path'
import { XMLParser } from 'fast-xml-parser'
import type { VersionSignal } from '../types.js'

const parser = new XMLParser({ ignoreAttributes: false })
const propertyReferencePattern = /\$\{([^}]+)\}/g
const maxInterpolationDepth = 10

interface MavenPlugin {
  artifactId?: unknown
  configuration?: Record<string, unknown>
}

interface MavenProject {
  parent?: {
    relativePath?: unknown
  }
  properties?: Record<string, unknown>
  build?: {
    plugins?: {
      plugin?: MavenPlugin[] | MavenPlugin
    }
    pluginManagement?: {
      plugins?: {
        plugin?: MavenPlugin[] | MavenPlugin
      }
    }
  }
}

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

function extractProperties(project: MavenProject): Record<string, unknown> {
  return project.properties ?? {}
}

function resolvePropertyValue(
  value: unknown,
  properties: Record<string, unknown>,
  visited = new Set<string>(),
  depth = 0,
): string | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value)
  }

  if (typeof value !== 'string') {
    return null
  }

  if (depth > maxInterpolationDepth) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed.includes('${')) {
    return trimmed
  }

  let unresolved = false
  const resolved = trimmed.replace(propertyReferencePattern, (_match, rawPropertyName: string) => {
    const propertyName = rawPropertyName.trim()
    if (propertyName.length === 0 || visited.has(propertyName)) {
      unresolved = true
      return ''
    }

    const propertyValue = properties[propertyName]
    if (propertyValue === undefined) {
      unresolved = true
      return ''
    }

    const nextVisited = new Set(visited)
    nextVisited.add(propertyName)
    const nested = resolvePropertyValue(propertyValue, properties, nextVisited, depth + 1)
    if (nested === null) {
      unresolved = true
      return ''
    }

    return nested
  })

  return unresolved ? null : resolved
}

function parseResolvedMajor(value: unknown, properties: Record<string, unknown>): number | null {
  const resolved = resolvePropertyValue(value, properties)
  if (resolved === null) {
    return null
  }

  return parseMajor(resolved)
}

function readSignalsFromPom(project: MavenProject, properties: Record<string, unknown>, detailPrefix = ''): VersionSignal[] {
  
  const signals: VersionSignal[] = []
  const propertySignals = [
    ['maven.compiler.release', 'maven.compiler.release'],
    ['maven.compiler.source', 'maven.compiler.source'],
    ['maven.compiler.target', 'maven.compiler.target'],
  ] as const

  for (const [propertyName, detail] of propertySignals) {
    const major = parseResolvedMajor(project.properties?.[propertyName], properties)
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

      const release = parseResolvedMajor(plugin.configuration?.release, properties)
      if (release !== null) {
        signals.push({ major: release, source: 'maven', detail: `${detailPrefix}maven-compiler-plugin:release` })
      }

      const source = parseResolvedMajor(plugin.configuration?.source, properties)
      if (source !== null) {
        signals.push({ major: source, source: 'maven', detail: `${detailPrefix}maven-compiler-plugin:source` })
      }

      const target = parseResolvedMajor(plugin.configuration?.target, properties)
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

  if (!project || typeof project !== 'object') {
    return []
  }

  const projectObject = project as MavenProject
  const projectProperties = extractProperties(projectObject)
  let parentProject: MavenProject | null = null
  let parentProperties: Record<string, unknown> = {}

  const parent = projectObject.parent
  if (parent) {
    const parentRelativePath = parent.relativePath
    if (parentRelativePath !== '') {
      const resolvedParentRelativePath = typeof parentRelativePath === 'string' ? parentRelativePath.trim() : '../pom.xml'
      if (resolvedParentRelativePath.length > 0) {
        const parentPomPath = path.resolve(projectRoot, resolvedParentRelativePath)
        try {
          const parentStat = await fs.stat(parentPomPath)
          const resolvedParentPomPath = parentStat.isDirectory() ? path.join(parentPomPath, 'pom.xml') : parentPomPath
          const loadedParent = await readPomObject(resolvedParentPomPath)
          if (loadedParent && typeof loadedParent === 'object') {
            parentProject = loadedParent as MavenProject
            parentProperties = extractProperties(parentProject)
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
        }
      }
    }
  }

  const mergedProperties = {
    ...parentProperties,
    ...projectProperties,
  }
  const signals = readSignalsFromPom(projectObject, mergedProperties)

  if (!parentProject) {
    return signals
  }

  signals.push(...readSignalsFromPom(parentProject, parentProperties, 'parent:'))

  return signals
}
