/** Historical snapshots remain attributable and unchanged during inspection. */
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished } from 'vitest'
import { LegacyRuns } from '../src/persistence/legacy.ts'

async function fixture(tail = '') {
  const root = await mkdtemp(join(tmpdir(), 'antfarm-legacy-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'af-old'))
  const path = join(root, 'af-old', 'events.jsonl')
  const events = [
    {
      version: 3,
      seq: 0,
      time: 1,
      type: 'run-start',
      data: {
        runId: 'af-old',
        ownerSessionId: 'owner',
        workflowId: 'feature-dev',
        workspace: '/retained',
        branch: 'feature/old',
        task: 'Old work',
      },
    },
    { version: 3, seq: 1, time: 2, type: 'checkpoint', data: { context: { changes: 'saved output' }, stories: [] } },
  ]
  const content = events.map((event) => JSON.stringify(event) + '\n').join('') + tail
  await writeFile(path, content)
  return { root, path, content, reader: new LegacyRuns(root) }
}

it('shows owner-scoped historical facts without changing a single byte', async () => {
  const { reader, path, content } = await fixture()
  const [run] = await reader.list('owner')
  expect(run?.summary.status).toBe('legacy')
  expect(run?.context).toEqual({ changes: 'saved output' })
  expect(await reader.list('other')).toEqual([])
  await expect(reader.status('af-old', 'other')).rejects.toThrow('another Session')
  expect((await reader.events('af-old', 'owner', -1)).map((event) => event.seq)).toEqual([0, 1])
  expect(await readFile(path, 'utf8')).toBe(content)
})

it('retains complete-prefix observations and labels an incomplete tail corrupt', async () => {
  const { reader, path, content } = await fixture('{"version":3')
  const value = await reader.status('af-old', 'owner')
  expect(value.summary.status).toBe('corrupt')
  expect(value.context.changes).toBe('saved output')
  expect(await readFile(path, 'utf8')).toBe(content)
})

it('rejects symbolic-link journals and traversal ids', async () => {
  const { reader, root, path } = await fixture()
  await mkdir(join(root, 'af-link'))
  await symlink(path, join(root, 'af-link', 'events.jsonl'))
  await expect(reader.status('af-link', 'owner')).rejects.toThrow('symbolic links')
  await expect(reader.status('../af-old', 'owner')).rejects.toThrow('invalid historical')
})
