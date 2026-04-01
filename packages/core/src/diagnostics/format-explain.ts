import type { ResolveResult } from '../types.js'

export function formatExplain(result: ResolveResult): string {
  if (result.kind === 'unresolved') {
    const sections = [
      `Resolution failed: ${result.code}`,
      `Project: ${result.projectRoot}`,
      `Command: ${result.command}`,
      `Sources examined: ${result.sourcesExamined.join(', ')}`,
      `Installed JDK majors: ${result.installedJdkMajors.join(', ') || 'none'}`,
      ...result.reasons,
      `Suggested next action: ${result.suggestedNextAction}`,
    ]

    if (result.versionFound?.length) {
      sections.splice(4, 0, `Version found: ${result.versionFound.join(', ')}`)
    }

    if (result.conflictFound?.length) {
      sections.splice(4, 0, `Conflict found: ${result.conflictFound.join(', ')}`)
    }

    return sections.join('\n')
  }

  return [
    `Selected JDK: ${result.candidate.javaHome}`,
    `Selected Java major: ${result.major}`,
    `Why selected: ${result.diagnostics.whySelected}`,
    `Used sources: ${result.diagnostics.usedSources.join(', ')}`,
    `Ignored sources: ${result.diagnostics.ignoredSources.join(', ') || 'none'}`,
    `JAVA_HOME=${result.env.JAVA_HOME}`,
  ].join('\n')
}
