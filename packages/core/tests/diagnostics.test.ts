import { describe, expect, it } from 'vitest'
import { formatDoctor, formatExplain } from '../src/index.js'

describe('diagnostics formatting', () => {
  it('formats unresolved explain output for fail-fast cases', () => {
    expect(
      formatExplain({
        kind: 'unresolved',
        code: 'NO_PROJECT',
        reasons: ['No pom.xml found in current working directory hierarchy.'],
        projectRoot: '/tmp/workspace',
        command: 'mvn test',
        sourcesExamined: ['command', 'version-file', 'maven'],
        installedJdkMajors: [17, 21],
        suggestedNextAction: 'Run the command from inside a Maven project.',
      }),
    ).toContain('Resolution failed: NO_PROJECT')
  })

  it('includes candidate source in doctor output', () => {
    expect(
      formatDoctor([
        {
          major: 17,
          fullVersion: '17.0.13',
          javaHome: '/jdks/17',
          javaBin: '/jdks/17/bin/java',
          javacBin: '/jdks/17/bin/javac',
          vendor: 'Temurin',
          source: 'sdkman',
          validated: true,
          arch: 'arm64',
        },
      ]),
    ).toContain('sdkman')
  })
})
