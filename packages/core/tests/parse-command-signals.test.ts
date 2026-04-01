import { describe, expect, it } from 'vitest'
import { parseCommandSignals } from '../src/signals/parse-command-signals.js'

describe('parseCommandSignals', () => {
  it('reads make JAVA override', () => {
    expect(parseCommandSignals('make JAVA=17 test')).toEqual([
      { major: 17, source: 'command', detail: 'make JAVA=17' },
    ])
  })

  it('reads maven property override', () => {
    expect(parseCommandSignals('mvn -Djava.version=21 test')).toEqual([
      { major: 21, source: 'command', detail: '-Djava.version=21' },
    ])
  })

  it('reads vendor-prefixed maven property override', () => {
    expect(parseCommandSignals('mvn -Djava.version=openjdk64-17.0.10 test')).toEqual([
      { major: 17, source: 'command', detail: '-Djava.version=openjdk64-17.0.10' },
    ])
  })

  it('reads java 8 style maven property override', () => {
    expect(parseCommandSignals('mvn -Djava.version=1.8 test')).toEqual([
      { major: 8, source: 'command', detail: '-Djava.version=1.8' },
    ])
  })

  it('reads java 8 vendor style maven property override', () => {
    expect(parseCommandSignals('mvn -Djava.version=1.8.0_402 test')).toEqual([
      { major: 8, source: 'command', detail: '-Djava.version=1.8.0_402' },
    ])
  })

  it('reads maven compiler release override', () => {
    expect(parseCommandSignals('mvn -Dmaven.compiler.release=21 test')).toEqual([
      { major: 21, source: 'command', detail: '-Dmaven.compiler.release=21' },
    ])
  })

  it('does not match similarly named maven property', () => {
    expect(parseCommandSignals('mvn -Dmaven.compilerXrelease=21 test')).toEqual([])
  })

  it('does not match bare JAVA assignment outside make', () => {
    expect(parseCommandSignals('JAVA=17 mvn test')).toEqual([])
  })
})
