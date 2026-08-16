import { describe, expect, it } from 'vitest'
import { parseAntfarmCommand } from '../src/commands/index.ts'

describe('antfarm command parsing', () => {
  it('runs ordinary text and explicit run text with the configured default workflow', () => {
    expect(parseAntfarmCommand('implement payment callbacks')).toEqual({ action: 'start', task: 'implement payment callbacks' })
    expect(parseAntfarmCommand('run implement payment callbacks')).toEqual({ action: 'start', task: 'implement payment callbacks' })
  })

  it('selects built-in shortcuts and custom workflows explicitly', () => {
    expect(parseAntfarmCommand('fix duplicate callbacks')).toEqual({ action: 'start', workflowId: 'bug-fix', task: 'duplicate callbacks' })
    expect(parseAntfarmCommand('audit authentication')).toEqual({ action: 'start', workflowId: 'security-audit', task: 'authentication' })
    expect(parseAntfarmCommand('smoke verify installation')).toEqual({ action: 'start', workflowId: 'smoke', task: 'verify installation' })
    expect(parseAntfarmCommand('run --workflow release prepare version 1')).toEqual({ action: 'start', workflowId: 'release', task: 'prepare version 1' })
  })

  it('keeps lifecycle commands distinct from tasks', () => {
    expect(parseAntfarmCommand('list')).toEqual({ action: 'list' })
    expect(parseAntfarmCommand('status af-123')).toEqual({ action: 'status', runId: 'af-123' })
    expect(parseAntfarmCommand('cancel af-123 obsolete')).toEqual({ action: 'cancel', runId: 'af-123', reason: 'obsolete' })
    expect(parseAntfarmCommand('resume af-123 use the new API')).toEqual({ action: 'resume', runId: 'af-123', guidance: 'use the new API' })
    expect(parseAntfarmCommand('cleanup af-123')).toEqual({ action: 'cleanup', runId: 'af-123' })
  })

  it('rejects incomplete or over-specified command forms', () => {
    for (const input of ['', 'run', 'run --workflow', 'run --workflow smoke', 'fix', 'audit', 'smoke', 'list extra', 'status', 'status af-123 extra', 'cancel', 'resume', 'cleanup']) {
      expect(parseAntfarmCommand(input), input).toBeUndefined()
    }
  })
})
