export type SignalSource = 'command' | 'version-file' | 'maven'

export interface VersionSignal {
  major: number
  source: SignalSource
  detail: string
}

export type InventorySource = 'manual' | 'macos' | 'windows' | 'sdkman' | 'asdf' | 'mise'

export interface JdkHomeDiscovery {
  home: string
  source: InventorySource
}

export interface JdkCandidate {
  major: number
  fullVersion: string
  javaHome: string
  javaBin: string
  javacBin: string
  vendor: string
  source: InventorySource
  validated: boolean
  arch: string
}

export type ResolveCode = 'NO_PROJECT' | 'NO_SIGNAL' | 'CONFLICT' | 'JDK_NOT_FOUND'

export interface ResolveDiagnostics {
  selectedJdk: JdkCandidate
  whySelected: string
  usedSignals: VersionSignal[]
  usedSources: SignalSource[]
  ignoredSources: SignalSource[]
  examinedSources: SignalSource[]
  installedJdkMajors: number[]
}

export interface ResolvedResult {
  kind: 'resolved'
  major: number
  env: Record<string, string>
  candidate: JdkCandidate
  projectRoot: string
  diagnostics: ResolveDiagnostics
}

export interface ResolveInput {
  cwd: string
  command: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  inventory?: JdkCandidate[]
}

export interface UnresolvedResult {
  kind: 'unresolved'
  code: ResolveCode
  reasons: string[]
  projectRoot: string
  command: string
  sourcesExamined: SignalSource[]
  versionFound?: number[]
  conflictFound?: number[]
  installedJdkMajors: number[]
  suggestedNextAction: string
}

export type ResolveResult = ResolvedResult | UnresolvedResult
