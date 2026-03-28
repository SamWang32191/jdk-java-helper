import * as childProcess from 'node:child_process'
import path from 'node:path'

import type { InventorySource, JdkCandidate } from '../types.js'

export interface ParsedJavaVersion {
  major: number
  fullVersion: string
  vendor: string
  arch: string
}

export interface NormalizeCandidateInput {
  javaHome: string
  major: number
  fullVersion: string
  vendor: string
  arch: string
  source: InventorySource
  platform: NodeJS.Platform
  validated?: boolean
}

export interface ValidateHomeOptions {
  source?: InventorySource
  spawnSync?: typeof childProcess.spawnSync
}

export interface ValidateCandidateHomeInput {
  home: string
  source?: InventorySource
}

function parseMajor(fullVersion: string): number | null {
  const legacyMatch = fullVersion.match(/^1\.(\d{1,2})(?:\D|$)/)
  if (legacyMatch) {
    return Number(legacyMatch[1])
  }

  const modernMatch = fullVersion.match(/^(\d{1,2})(?:\.\d+)*(?:[+_].*)?$/)
  if (modernMatch) {
    return Number(modernMatch[1])
  }

  return null
}

function sourceFromPlatform(platform: NodeJS.Platform): InventorySource {
  if (platform === 'darwin') {
    return 'macos'
  }

  if (platform === 'win32') {
    return 'windows'
  }

  return 'sdkman'
}

function javaBinaryName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'java.exe' : 'java'
}

function javacBinaryName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'javac.exe' : 'javac'
}

function joinBinPath(javaHome: string, binary: string, platform: NodeJS.Platform): string {
  return platform === 'win32' ? path.win32.join(javaHome, 'bin', binary) : path.join(javaHome, 'bin', binary)
}

function runVersion(spawnSync: typeof childProcess.spawnSync, binary: string): string | null {
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8' })
  if (result.status !== 0) {
    return null
  }

  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`
}

function inferArch(output: string): string {
  const archMatch = output.match(/\((aarch64|arm64|x86_64|amd64)\)/i)
  return archMatch?.[1].toLowerCase() || 'unknown'
}

export function parseJavaVersionOutput(output: string): ParsedJavaVersion | null {
  const line = output.split(/\r?\n/).find((current) => /version\s+"/.test(current))
  if (!line) {
    return null
  }

  const match = line.match(/^(.*?)\s+version\s+"([^"]+)"/i)
  if (!match) {
    return null
  }

  const fullVersion = match[2]
  const major = parseMajor(fullVersion)
  if (major === null) {
    return null
  }

  return {
    major,
    fullVersion,
    vendor: match[1].trim().toLowerCase(),
    arch: inferArch(output),
  }
}

export function normalizeCandidate(input: NormalizeCandidateInput): JdkCandidate {
  return {
    major: input.major,
    fullVersion: input.fullVersion,
    javaHome: input.javaHome,
    javaBin: joinBinPath(input.javaHome, javaBinaryName(input.platform), input.platform),
    javacBin: joinBinPath(input.javaHome, javacBinaryName(input.platform), input.platform),
    vendor: input.vendor,
    source: input.source,
    validated: input.validated ?? false,
    arch: input.arch,
  }
}

export async function validateHome(
  javaHome: string,
  platform: NodeJS.Platform,
  options: ValidateHomeOptions = {},
): Promise<JdkCandidate | null> {
  const spawnSync = options.spawnSync ?? childProcess.spawnSync
  const javaBinary = joinBinPath(javaHome, javaBinaryName(platform), platform)
  const javaOutput = runVersion(spawnSync, javaBinary)
  if (!javaOutput) {
    return null
  }

  const parsed = parseJavaVersionOutput(javaOutput)
  if (!parsed) {
    return null
  }

  const javacBinary = joinBinPath(javaHome, javacBinaryName(platform), platform)
  const javacOutput = runVersion(spawnSync, javacBinary)
  if (!javacOutput) {
    return null
  }

  return normalizeCandidate({
    javaHome,
    major: parsed.major,
    fullVersion: parsed.fullVersion,
    vendor: parsed.vendor,
    arch: parsed.arch,
    source: options.source ?? sourceFromPlatform(platform),
    platform,
    validated: true,
  })
}

export async function validateCandidates(
  homes: Array<string | ValidateCandidateHomeInput>,
  platform: NodeJS.Platform,
  options: ValidateHomeOptions = {},
): Promise<JdkCandidate[]> {
  const candidates: JdkCandidate[] = []

  for (const item of homes) {
    const home = typeof item === 'string' ? item : item.home
    const candidate = await validateHome(home, platform, {
      ...options,
      source: typeof item === 'string' ? options.source : item.source ?? options.source,
    })
    if (candidate) {
      candidates.push(candidate)
    }
  }

  return candidates
}
