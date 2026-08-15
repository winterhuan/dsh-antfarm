import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupWorktree, createWorktree, prepareRepository, resolveWorktreeSpec, runGit } from '../src/workspace/git.ts'

const disposers: Array<() => Promise<void>> = []

async function context(): Promise<Context> {
  const ctx = new Context()
  const fiber = await ctx.plugin(LocalSubprocessRuntime)
  disposers.push(() => fiber.dispose())
  return ctx
}

async function repository(ctx: Context): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'antfarm-repo-'))
  for (const args of [
    ['init', '-b', 'main'],
    ['config', 'user.email', 'antfarm@example.test'],
    ['config', 'user.name', 'Antfarm Test'],
  ]) expect((await runGit(ctx.subprocess, root, args)).exitCode).toBe(0)
  await writeFile(join(root, 'README.md'), 'base\n')
  expect((await runGit(ctx.subprocess, root, ['add', 'README.md'])).exitCode).toBe(0)
  expect((await runGit(ctx.subprocess, root, ['commit', '-m', 'base'])).exitCode).toBe(0)
  return root
}

afterEach(async () => {
  await Promise.allSettled(disposers.splice(0).map(dispose => dispose()))
})

describe('project-local worktrees', () => {
  it('creates an ignored worktree and removes it only while clean', async () => {
    const ctx = await context()
    const root = await repository(ctx)
    const prepared = await prepareRepository(ctx.subprocess, root)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-clean')
    await createWorktree(ctx.subprocess, spec)
    expect((await stat(spec.path)).isDirectory()).toBe(true)
    expect(await readFile(join(prepared.gitCommonDirectory, 'info', 'exclude'), 'utf8')).toContain('/.worktrees/')
    await expect(cleanupWorktree(ctx.subprocess, spec)).resolves.toEqual({ disposition: 'cleaned' })
    await expect(stat(spec.path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains dirty or untracked output without force removal', async () => {
    const ctx = await context()
    const root = await repository(ctx)
    const prepared = await prepareRepository(ctx.subprocess, root)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-dirty')
    await createWorktree(ctx.subprocess, spec)
    await writeFile(join(spec.path, 'agent-output.txt'), 'preserve me\n')
    await expect(cleanupWorktree(ctx.subprocess, spec)).resolves.toEqual({ disposition: 'retained', reason: 'worktree contains tracked or untracked changes' })
    expect(await readFile(join(spec.path, 'agent-output.txt'), 'utf8')).toBe('preserve me\n')
  })

  it('rejects repositories that track .worktrees content', async () => {
    const ctx = await context()
    const root = await repository(ctx)
    const prepared = await prepareRepository(ctx.subprocess, root)
    await writeFile(join(root, '.gitignore'), '!/.worktrees/\n')
    await writeFile(join(root, '.worktrees'), 'tracked file\n')
    expect((await runGit(ctx.subprocess, root, ['add', '-f', '.worktrees'])).exitCode).toBe(0)
    expect((await runGit(ctx.subprocess, root, ['commit', '-m', 'track worktrees'])).exitCode).toBe(0)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-reject')
    await expect(createWorktree(ctx.subprocess, spec)).rejects.toThrow('repository tracks .worktrees')
  })
})
