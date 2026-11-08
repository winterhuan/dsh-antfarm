import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { GitHubDelivery } from '../src/runtime/github.ts'
import { frontendPaths, retainScreenshots } from '../src/runtime/visual.ts'
import type { CheckEvidence, RunStartData } from '../src/persistence/types.ts'
import { loadWorkflow } from '../src/workflow/loader.ts'

const commands = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../src/workspace/git.ts', () => ({ runGit: (...args: unknown[]) => commands.run('git', ...args), runExecutable: (_runtime: unknown, program: string, ...args: unknown[]) => commands.run(program, ...args) }))

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-delivery-')))
  onTestFinished(async () => { commands.run.mockReset(); await rm(root, { recursive: true, force: true }) })
  const workflow = await loadWorkflow('smoke', [join(import.meta.dirname, '../workflows')])
  const start: RunStartData = { runId: 'af-delivery', ownerSessionId: 'owner', workflowId: 'smoke', task: 'Deliver', baseCwd: root, workspace: root, branch: 'antfarm/af-delivery', provider: 'spawn', baseRevision: 'a'.repeat(40), resolvedWorkflowSnapshot: workflow }
  const pr = { url: 'https://github.com/example/project/pull/1', headRefOid: 'b'.repeat(40), headRefName: start.branch, state: 'OPEN', author: { login: 'author' }, reviews: [{ id: 'approval', author: { login: 'reviewer' }, state: 'APPROVED', commit: { oid: 'b'.repeat(40) } }] }
  commands.run.mockImplementation((program: string, _runtimeOrCwd: unknown, cwdOrArgs: unknown, argsOrSignal: unknown) => {
    const args = (program === 'git' ? argsOrSignal : cwdOrArgs) as string[]
    return { exitCode: 0, stderr: '', stdout: program === 'git' ? args[0] === 'status' ? '' : 'b'.repeat(40) : JSON.stringify(pr) }
  })
  return { root, start, pr, delivery: new GitHubDelivery({} as SubprocessRuntime), signal: new AbortController().signal }
}

describe('candidate-bound delivery and visuals', () => {
  it('lets the author collect an existing independent approval only for the current head', async () => {
    const test = await fixture()
    commands.run.mockImplementation((_program: string, _cwd: unknown, args: string[]) => ({
      exitCode: 0, stderr: '', stdout: args[0] === 'api' ? 'author' : args[0] === 'repo' ? JSON.stringify({ viewerPermission: 'WRITE' }) : JSON.stringify(test.pr),
    }))
    test.pr.reviews[0]!.commit.oid = 'a'.repeat(40)
    await expect(test.delivery.preflight(test.start, 'github-review', test.signal)).rejects.toThrow('self-approval')
    test.pr.reviews[0]!.commit.oid = test.pr.headRefOid
    await expect(test.delivery.preflight(test.start, 'github-review', test.signal)).resolves.toBe('author')
    test.pr.reviews.push({ ...test.pr.reviews[0]!, id: 'changes', state: 'CHANGES_REQUESTED' })
    await expect(test.delivery.preflight(test.start, 'github-review', test.signal)).rejects.toThrow('self-approval')
  })

  it('rejects a stale head, self-approval and a superseded approving review', async () => {
    const test = await fixture()
    await expect(test.delivery.verify(test.start, 'github-review', {}, test.signal)).resolves.toMatchObject({ review_id: 'approval' })
    test.pr.headRefOid = 'c'.repeat(40)
    await expect(test.delivery.verify(test.start, 'github-review', {}, test.signal)).rejects.toThrow('PR head')
    test.pr.headRefOid = 'b'.repeat(40); test.pr.reviews[0]!.author.login = 'author'
    await expect(test.delivery.verify(test.start, 'github-review', {}, test.signal)).rejects.toThrow('distinct')
    test.pr.reviews[0]!.author.login = 'reviewer'
    test.pr.reviews.push({ ...test.pr.reviews[0]!, id: 'request-changes', state: 'CHANGES_REQUESTED' })
    await expect(test.delivery.verify(test.start, 'github-review', {}, test.signal)).rejects.toThrow('distinct')
  })

  it('does not treat a shell echo or a changed candidate as browser evidence', async () => {
    const { root } = await fixture()
    const version = 'a'.repeat(64)
    const record: CheckEvidence = { callId: 'check', childSessionId: 'child', stepId: 'verify', cwd: root, command: 'echo playwright', candidate: version, afterCandidate: version, passed: true, exitCode: 0, stdout: '', stderr: '' }
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
    await writeFile(join(root, 'render.png'), png)
    await expect(retainScreenshots(root, ['render.png'], [record], version, join(root, 'retained'))).rejects.toThrow('browser')
    const refs = await retainScreenshots(root, ['render.png'], [{ ...record, command: 'pnpm exec playwright test' }], version, join(root, 'retained'))
    expect(await readFile(join(root, 'retained', refs[0]!.sha256))).toEqual(png)
    await symlink(join(root, '../outside.png'), join(root, 'escape.png'))
    await expect(retainScreenshots(root, ['escape.png'], [{ ...record, command: 'playwright test' }], version, join(root, 'retained'))).rejects.toThrow()
    await expect(retainScreenshots(root, ['render.png'], [{ ...record, command: 'playwright test', afterCandidate: 'b'.repeat(64) }], version, join(root, 'retained'))).rejects.toThrow('browser')
  })

  it('matches original frontend paths while excluding test code', () => {
    expect(frontendPaths(['src/app.tsx', 'styles/base.css', 'server/main.ts', 'src/app.spec.tsx', '__tests__/page.html'])).toEqual(['src/app.tsx', 'styles/base.css'])
  })
})
