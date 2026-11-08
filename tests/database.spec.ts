import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, onTestFinished } from 'vitest'
import { AntfarmDatabase, parseOutputKeyValues, resolveTemplate } from '../src/persistence/database.ts'
import { loadWorkflow } from '../src/workflow/loader.ts'
const root = join(import.meta.dirname, '../workflows')
async function fixture(id = 'feature-dev') {
  const home = await mkdtemp(join(tmpdir(), 'antfarm-sql-'))
  const db = new AntfarmDatabase(join(home, 'antfarm.db'))
  onTestFinished(async () => {
    db.dispose()
    await rm(home, { recursive: true, force: true })
  })
  const workflow = await loadWorkflow(id, [root])
  const run = db.start(workflow, 'Implement a small feature', 'owner', home)
  return { db, workflow, run, home }
}
const story = { id: 'S1', title: 'A story', description: 'Implement it', acceptanceCriteria: ['A real check passes'] }
const plan = (home: string, stories = [story]) =>
  `STATUS: done\nREPO: ${home}\nBRANCH: feature/test\nSTORIES_JSON: ${JSON.stringify(stories)}`
const output =
  'STATUS: done\nCHANGES: implementation\nTESTS: passed\nTEST_CMD: npm test\nBUILD_CMD: npm run build\nBASELINE: passes\nRESULTS: passes\nPR: https://example.test/pr/1\nDECISION: approved'
describe('original SQLite worker protocol', () => {
  it('keeps original business tables and columns instead of journal projections', async () => {
    const { db } = await fixture()
    expect(
      db.db
        .prepare('PRAGMA table_info(steps)')
        .all()
        .map((row) => row.name),
    ).toEqual([
      'id',
      'run_id',
      'step_id',
      'agent_id',
      'step_index',
      'input_template',
      'expects',
      'status',
      'output',
      'retry_count',
      'max_retries',
      'created_at',
      'updated_at',
      'type',
      'loop_config',
      'current_story_id',
      'abandoned_count',
    ])
    expect(
      db.db
        .prepare('PRAGMA table_info(runs)')
        .all()
        .map((row) => row.name),
    ).toEqual([
      'id',
      'workflow_id',
      'task',
      'status',
      'context',
      'created_at',
      'updated_at',
      'notify_url',
      'run_number',
    ])
  })
  it('runs feature development through story verification and final PR review', async () => {
    const { db, run, home } = await fixture()
    const names: string[] = []
    for (let i = 0; i < 12 && db.run(run).status === 'running'; i++) {
      const claim = db.claim(run)
      expect(claim, 'ready step').toBeDefined()
      names.push(claim!.step.step_id)
      db.complete(claim!.sessionId, claim!.step.step_id === 'plan' ? plan(home) : output)
    }
    expect(names).toEqual(['plan', 'setup', 'implement', 'verify', 'test', 'pr', 'review'])
    expect(db.run(run).status).toBe('completed')
    expect(db.stories(run)[0]?.status).toBe('done')
    expect(db.events(run).at(-1)?.event).toBe('run.completed')
  })
  it('verifies each story using a fresh attempt and retries only the rejected story', async () => {
    const { db, run, home } = await fixture()
    db.complete(db.claim(run)!.sessionId, plan(home, [story, { ...story, id: 'S2' }]))
    db.complete(db.claim(run)!.sessionId, output)
    const first = db.claim(run)!
    db.complete(first.sessionId, output)
    const verify = db.claim(run)!
    expect(verify.step.step_id).toBe('verify')
    db.complete(verify.sessionId, 'STATUS: retry\nISSUES: missing regression test')
    const retry = db.claim(run)!
    expect(retry.input).toContain('missing regression test')
    expect(retry.sessionId).not.toBe(first.sessionId)
    expect(db.stories(run)[0]?.retry_count).toBe(1)
    db.complete(retry.sessionId, output)
    db.complete(db.claim(run)!.sessionId, output)
    expect(db.claim(run)?.input).toContain('Story S2')
  })
  it('rolls back malformed planning output without leaking accepted context', async () => {
    const { db, run } = await fixture()
    const claim = db.claim(run)!
    expect(() =>
      db.complete(
        claim.sessionId,
        `STATUS: done\nREPO: wrong\nSTORIES_JSON: ${JSON.stringify([story, { ...story, id: 'S1' }])}`,
      ),
    ).toThrow()
    expect(db.stories(run)).toEqual([])
    expect(JSON.parse(db.run(run).context).repo).toBeUndefined()
    expect(db.steps(run)[0]?.status).toBe('running')
  })
  it('serializes competing connections and rejects stale completion after cancellation', async () => {
    const { db, run, home } = await fixture()
    const other = new AntfarmDatabase(join(home, 'antfarm.db'))
    onTestFinished(() => other.dispose())
    const first = db.claim(run)!
    expect(other.claim(run)).toBeUndefined()
    other.cancel(run)
    expect(db.complete(first.sessionId, output)).toBe(false)
    expect(db.run(run).status).toBe('cancelled')
  })
  it('makes admission idempotent and rejects reuse for another task', async () => {
    const { db, workflow, home } = await fixture()
    const first = db.start(workflow, 'task', 'owner', home, 'request')
    expect(db.start(workflow, 'task', 'owner', home, 'request')).toBe(first)
    expect(() => db.start(workflow, 'changed', 'owner', home, 'request')).toThrow('another task')
  })
  it('exhausts the original step budget and resumes the failed step', async () => {
    const { db, run } = await fixture()
    for (let i = 0; i < 3; i++) db.fail(db.claim(run)!.sessionId, 'failed')
    expect(db.run(run).status).toBe('failed')
    expect(db.steps(run)[0]?.retry_count).toBe(3)
    db.resume(run)
    expect(db.claim(run)?.step.step_id).toBe('plan')
    expect(db.steps(run)[0]?.retry_count).toBe(0)
  })
  it('preserves consumed story retries when resuming an exhausted loop', async () => {
    const { db, run, home } = await fixture()
    db.complete(db.claim(run)!.sessionId, plan(home))
    db.complete(db.claim(run)!.sessionId, output)
    for (let i = 0; i < 3; i++) db.fail(db.claim(run)!.sessionId, 'story failed')
    expect(db.stories(run)[0]?.retry_count).toBe(3)
    db.resume(run)
    expect(db.stories(run)[0]?.retry_count).toBe(3)
    expect(db.claim(run)?.input).toContain('Story S1')
  })
  it('tracks abandoned single attempts separately from explicit failures', async () => {
    const { db, run } = await fixture()
    for (let i = 0; i < 5; i++) db.abandon(db.claim(run)!.sessionId)
    expect(db.run(run).status).toBe('failed')
    expect(db.steps(run)[0]?.abandoned_count).toBe(5)
    expect(db.steps(run)[0]?.retry_count).toBe(0)
  })
  it('refuses a second native dispatcher while preserving concurrent read access', async () => {
    const { db, home, run } = await fixture()
    const other = new AntfarmDatabase(join(home, 'antfarm.db'))
    onTestFinished(() => other.dispose())
    db.acquireHost()
    expect(() => other.acquireHost()).toThrow('Another Antfarm host')
    expect(other.run(run).status).toBe('running')
  })
  it('keeps separate stores and sessions independent', async () => {
    const a = await fixture(),
      b = await fixture()
    const one = a.db.claim(a.run)!,
      two = b.db.claim(b.run)!
    expect(one.sessionId).not.toBe(two.sessionId)
    a.db.cancel(a.run)
    expect(b.db.run(b.run).status).toBe('running')
  })
  it('parses original multiline values and resolves dotted and case-insensitive inputs', () => {
    expect(parseOutputKeyValues('STATUS: done\nCHANGES: first\nsecond\nSTORIES_JSON: []')).toEqual({
      status: 'done',
      changes: 'first\nsecond',
    })
    expect(resolveTemplate('{{TASK}} {{a.b}}', { task: 'work', 'a.b': 'value' })).toBe('work value')
  })
})
