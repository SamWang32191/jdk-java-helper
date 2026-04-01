import type { JdkCandidate } from '../types.js'

export interface DoctorReport {
  inventory: JdkCandidate[]
  invalidJdkPaths: string[]
  missingMajors: number[]
  recentProjectNeeds: number[]
}

export function formatDoctor(input: DoctorReport | JdkCandidate[]): string {
  const report = Array.isArray(input)
    ? { inventory: input, invalidJdkPaths: [], missingMajors: [], recentProjectNeeds: [] }
    : input

  const lines = ['Discovered JDK inventory']

  if (report.inventory.length === 0) {
    lines.push('  (none)')
  } else {
    for (const candidate of report.inventory) {
      lines.push(`  ${candidate.major}\t${candidate.fullVersion}\t${candidate.source}\t${candidate.javaHome}`)
    }
  }

  lines.push(`Invalid JDK paths: ${report.invalidJdkPaths.length > 0 ? report.invalidJdkPaths.join(', ') : 'none'}`)
  lines.push(`Missing majors vs recent needs: ${report.missingMajors.length > 0 ? report.missingMajors.join(', ') : 'none'}`)
  lines.push(`Recent project needs: ${report.recentProjectNeeds.length > 0 ? report.recentProjectNeeds.join(', ') : 'none'}`)

  return lines.join('\n')
}
