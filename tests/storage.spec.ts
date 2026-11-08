import { fork } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RunStorage } from '../src/persistence/storage.ts'

describe('OS-owned storage root', () => {
  it('excludes another process and permits recovery after proven owner exit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-storage-'))
    const child = fork(new URL('./fixtures/storage-owner.mjs', import.meta.url), [root], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
    const exit = once(child, 'exit')
    let exited = false; void exit.then(() => { exited = true })
    let stderr = ''; child.stderr?.on('data', chunk => { stderr += String(chunk) })
    try {
      const ready = await Promise.race([once(child, 'message'), exit.then(() => { throw new Error(stderr || 'storage owner exited before readiness') })])
      expect(ready[0]).toEqual({ ready: true })
      await expect(RunStorage.acquire(root)).rejects.toThrow('already being held')
      child.kill('SIGKILL'); await exit
      const restored = await RunStorage.acquire(root)
      try { expect(restored.list('owner')).toEqual([]) } finally { restored.dispose() }
    } finally {
      if (!exited) { child.kill('SIGKILL'); await exit }
      await rm(root, { recursive: true, force: true })
    }
  })
})
