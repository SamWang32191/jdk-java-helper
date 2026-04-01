import os from 'node:os'
import path from 'node:path'

import { discoverMacosJdkHomes } from '../inventory/discover-macos.js'
import { discoverManagerHomes } from '../inventory/discover-managers.js'
import { discoverWindowsJdkHomes } from '../inventory/discover-windows.js'
import { validateCandidates } from '../inventory/validate-candidates.js'
import { findProjectRoot } from '../project/find-project-root.js'
import { parseCommandSignals } from '../signals/parse-command-signals.js'
import { readPomSignals } from '../signals/read-pom-signals.js'
import { readVersionFiles } from '../signals/read-version-files.js'
import type { JdkCandidate, JdkHomeDiscovery, ResolveInput, ResolveResult, SignalSource, VersionSignal } from '../types.js'

function pickSignals(commandSignals: VersionSignal[], repoSignals: VersionSignal[], pomSignals: VersionSignal[]): VersionSignal[] {
  if (commandSignals.length > 0) {
    return commandSignals
  }

  if (repoSignals.length > 0) {
    return repoSignals
  }

  return pomSignals
}

function hasConflict(signals: VersionSignal[]): boolean {
  return new Set(signals.map((signal) => signal.major)).size > 1
}

function signalSourceLabel(signals: VersionSignal[]): string {
  if (signals.length === 0) {
    return 'none'
  }

  if (signals.every((signal) => signal.source === 'command')) {
    return 'exact command override'
  }

  if (signals.every((signal) => signal.source === 'version-file')) {
    return 'repo version file'
  }

  return 'static Maven signal'
}

function buildEnv(candidate: JdkCandidate, env: NodeJS.ProcessEnv): Record<string, string> {
  const cleanEnv: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      cleanEnv[key] = value
    }
  }

  const binDir = path.dirname(candidate.javaBin)
  return {
    ...cleanEnv,
    JAVA_HOME: candidate.javaHome,
    PATH: `${binDir}${path.delimiter}${cleanEnv.PATH ?? ''}`,
  }
}

function selectExactMatch(inventory: JdkCandidate[], requiredMajor: number): JdkCandidate | null {
  const candidates = inventory.filter((candidate) => candidate.major === requiredMajor)
  if (candidates.length === 0) {
    return null
  }

  const priority = new Map<JdkCandidate['source'], number>([
    ['manual', 0],
    ['macos', 1],
    ['windows', 1],
    ['sdkman', 2],
    ['asdf', 2],
    ['mise', 2],
  ])

  return [...candidates].sort((left, right) => {
    if (left.validated !== right.validated) {
      return left.validated ? -1 : 1
    }

    const leftPriority = priority.get(left.source) ?? 99
    const rightPriority = priority.get(right.source) ?? 99
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return left.javaHome.localeCompare(right.javaHome)
  })[0]
}

export async function discoverInventory(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): Promise<JdkCandidate[]> {
  const homeDir = env.HOME ?? env.USERPROFILE ?? os.homedir()
  const homes = new Map<string, JdkHomeDiscovery>()

  if (platform === 'darwin') {
    for (const home of await discoverMacosJdkHomes()) {
      homes.set(`macos:${home}`, { home, source: 'macos' })
    }
  } else if (platform === 'win32') {
    for (const home of await discoverWindowsJdkHomes()) {
      homes.set(`windows:${home}`, { home, source: 'windows' })
    }
  }

  for (const discovery of await discoverManagerHomes(homeDir)) {
    homes.set(`${discovery.source}:${discovery.home}`, discovery)
  }

  return validateCandidates([...homes.values()], platform)
}

function formatSignalReasons(signals: VersionSignal[]): string[] {
  return signals.map((signal) => `${signal.source}:${signal.detail}`)
}

function formatAvailableMajors(inventory: JdkCandidate[]): string {
  const majors = [...new Set(inventory.map((candidate) => candidate.major))].sort((left, right) => left - right)
  return majors.length > 0 ? majors.join(', ') : 'none'
}

function installedMajors(inventory: JdkCandidate[]): number[] {
  return [...new Set(inventory.map((candidate) => candidate.major))].sort((left, right) => left - right)
}

function determineIgnoredSources(chosen: VersionSignal[]): SignalSource[] {
  const used = new Set(chosen.map((signal) => signal.source))
  const all: SignalSource[] = ['command', 'version-file', 'maven']
  return all.filter((source) => !used.has(source))
}

function resolveFromSignals(
  input: ResolveInput,
  projectRoot: string,
  signals: VersionSignal[],
  inventory: JdkCandidate[],
  sourcesExamined: SignalSource[],
): ResolveResult {
  if (hasConflict(signals)) {
    return {
      kind: 'unresolved',
      code: 'CONFLICT',
      reasons: ['Explicit Java signals conflict.'],
      projectRoot,
      command: input.command,
      sourcesExamined,
      conflictFound: [...new Set(signals.map((signal) => signal.major))].sort((left, right) => left - right),
      installedJdkMajors: installedMajors(inventory),
      suggestedNextAction: 'Remove conflicting explicit Java signals.',
    }
  }

  const requiredMajor = signals[0].major
  const candidate = selectExactMatch(inventory, requiredMajor)

  if (!candidate) {
    return {
      kind: 'unresolved',
      code: 'JDK_NOT_FOUND',
      reasons: [`Missing JDK ${requiredMajor}.`, `Installed JDK majors: ${formatAvailableMajors(inventory)}`],
      projectRoot,
      command: input.command,
      sourcesExamined,
      versionFound: [requiredMajor],
      installedJdkMajors: installedMajors(inventory),
      suggestedNextAction: `install JDK ${requiredMajor} or configure a manual path override.`,
    }
  }

  return {
    kind: 'resolved',
    major: requiredMajor,
    candidate,
    projectRoot,
    env: buildEnv(candidate, input.env),
    diagnostics: {
      selectedJdk: candidate,
      whySelected: signalSourceLabel(signals),
      usedSignals: signals,
      usedSources: [...new Set(signals.map((signal) => signal.source))],
      ignoredSources: determineIgnoredSources(signals),
      examinedSources: sourcesExamined,
      installedJdkMajors: installedMajors(inventory),
    },
  }
}

export async function resolveJdk(input: ResolveInput): Promise<ResolveResult> {
  const inventory = input.inventory ?? await discoverInventory(input.platform, input.env)
  const projectRoot = await findProjectRoot(input.cwd)
  if (!projectRoot) {
    return {
      kind: 'unresolved',
      code: 'NO_PROJECT',
      reasons: ['No pom.xml found in current working directory hierarchy.'],
      projectRoot: input.cwd,
      command: input.command,
      sourcesExamined: [],
      installedJdkMajors: installedMajors(inventory),
      suggestedNextAction: 'Run the command from inside a Maven project.',
    }
  }

  const sourcesExamined: SignalSource[] = ['command']
  const commandSignals = parseCommandSignals(input.command)
  if (commandSignals.length > 0) {
    return resolveFromSignals(input, projectRoot, commandSignals, inventory, ['command'])
  }

  sourcesExamined.push('version-file')
  const repoSignals = await readVersionFiles(projectRoot)
  if (repoSignals.length > 0) {
    return resolveFromSignals(input, projectRoot, repoSignals, inventory, sourcesExamined)
  }

  sourcesExamined.push('maven')
  const pomSignals = await readPomSignals(projectRoot)
  if (pomSignals.length > 0) {
    return resolveFromSignals(input, projectRoot, pomSignals, inventory, sourcesExamined)
  }

  return {
    kind: 'unresolved',
    code: 'NO_SIGNAL',
    reasons: ['No explicit Java signal found.'],
    projectRoot,
    command: input.command,
    sourcesExamined,
    installedJdkMajors: installedMajors(inventory),
    suggestedNextAction: 'Add an explicit command override or a repo Java version file.',
  }
}
