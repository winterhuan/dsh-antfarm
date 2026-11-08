import { execFile, type ExecFileException } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const fixture = fileURLToPath(new URL('./fixtures/composition-smoke.ts', import.meta.url))
const repository = fileURLToPath(new URL('../', import.meta.url))

async function runComposition(args: string[] = []) {
  const temporary = await mkdtemp(join(tmpdir(), 'antfarm-composition-'))
  try {
    // Plain Node loads the plugin's built exports; its deadline leaves time for child exit and cleanup.
    return await new Promise<{ error: ExecFileException | null; stdout: string; stderr: string }>(resolve => {
      execFile(process.execPath, [fixture, temporary, ...args], {
        cwd: repository, timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
      }, (error, stdout, stderr) => resolve({ error, stdout, stderr }))
    })
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

describe('Cordis Loader composition with prebuilt host entries', () => {
  it('registers five tools, commands and authorized Studio methods, then disposes every contribution', async () => {
    const result = await runComposition()
    expect(result.error?.killed).not.toBe(true)
    expect(result.error?.signal ?? null).toBeNull()
    expect(result.error, result.stderr).toBeNull()
    expect(result.stderr).toBe('')
    expect(JSON.parse(result.stdout)).toEqual({
      toolNames: ['antfarm_cancel', 'antfarm_list', 'antfarm_resume', 'antfarm_run', 'antfarm_status'],
      commands: ['antfarm'],
      studioMethods: ['board', 'control', 'copyWorkflow', 'ensureExecution', 'events', 'health', 'healthHistory', 'list', 'page', 'removeWorkflow', 'saveWorkflow', 'setWorkflowEnabled', 'start', 'status', 'workflow', 'workflows'],
      studioRuns: [],
      disposed: { tools: [], commands: [], runtime: false, studio: false },
    })
  }, 60000)

  it('fails when the runtime jobs dependency is absent', async () => {
    const result = await runComposition(['--omit-jobs'])
    expect(result.error?.killed).not.toBe(true)
    expect(result.error?.signal ?? null).toBeNull()
    expect(result.error?.code).toBe(1)
    expect(result.stderr).toContain('runtime row is not active')
    expect(result.stdout).toBe('')
  }, 60000)
})
