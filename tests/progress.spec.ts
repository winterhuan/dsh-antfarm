/** Original external memory and frontend detection stay independent of model output. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { archiveProgress, isFrontendChange, readProgress } from '../src/runtime/progress.ts'

it('ignores frontend tests and detects production paths with either separator', () => {
  expect(isFrontendChange(['src/App.spec.tsx', 'src/__tests__/App.tsx', 'server/index.ts'])).toBe(false)
  expect(isFrontendChange(['src/App.tsx'])).toBe(true)
  expect(isFrontendChange(['src\\components\\button.js'])).toBe(true)
})

it('archives per-run progress before the shared fallback without losing either file', async () => {
  const home = await mkdtemp(join(tmpdir(), 'antfarm-progress-'))
  onTestFinished(() => rm(home, { recursive: true, force: true }))
  await writeFile(join(home, 'progress-run.txt'), 'Run memory')
  await writeFile(join(home, 'progress.txt'), 'Shared memory')
  await archiveProgress(home, 'run')
  expect(await readFile(join(home, 'archive/run/progress.txt'), 'utf8')).toBe('Run memory')
  expect((await readProgress(home, 'run'))?.text).toBe('Shared memory')
  await archiveProgress(home, 'other')
  expect(await readFile(join(home, 'archive/other/progress.txt'), 'utf8')).toBe('Shared memory')
  expect(await readProgress(home, 'other')).toBeUndefined()
})
