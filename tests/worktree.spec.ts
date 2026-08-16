import { spawn } from 'node:child_process'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it } from 'vitest'
import { cleanupWorktree, createWorktree, prepareRepository, resolveWorktreeSpec, runGit } from '../src/workspace/git.ts'

function subprocess(): SubprocessRuntime {
  return {
    async resolveExecutable(command: string) { return command },
    spawn(spec) {
      const child = spawn(spec.argv[0] as string, spec.argv.slice(1), { cwd: spec.cwd, signal: spec.signal })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      child.stdout?.on('data', chunk => { stdout.push(Buffer.from(chunk)) })
      child.stderr?.on('data', chunk => { stderr.push(Buffer.from(chunk)) })
      const done = new Promise<{ exitCode: number | null }>((resolve, reject) => {
        child.once('error', reject)
        child.once('close', exitCode => { resolve({ exitCode }) })
      })
      const reader = (chunks: Buffer[]) => ({ readFrom: (offset: number) => ({ text: Buffer.concat(chunks).subarray(offset).toString('utf8') }) })
      return { done, collected: { stdout: reader(stdout), stderr: reader(stderr) } }
    },
  } as unknown as SubprocessRuntime
}

async function repository(runtime: SubprocessRuntime): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'antfarm-repo-'))
  for (const args of [
    ['init', '-b', 'main'],
    ['config', 'user.email', 'antfarm@example.test'],
    ['config', 'user.name', 'Antfarm Test'],
  ]) expect((await runGit(runtime, root, args)).exitCode).toBe(0)
  await writeFile(join(root, 'README.md'), 'base\n')
  expect((await runGit(runtime, root, ['add', 'README.md'])).exitCode).toBe(0)
  expect((await runGit(runtime, root, ['commit', '-m', 'base'])).exitCode).toBe(0)
  return root
}

describe('project-local worktrees', () => {
  it('creates an ignored worktree and removes it only while clean', async () => {
    const runtime = subprocess()
    const root = await repository(runtime)
    const prepared = await prepareRepository(runtime, root)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-clean')
    await createWorktree(runtime, spec)
    expect((await stat(spec.path)).isDirectory()).toBe(true)
    expect(await readFile(join(prepared.gitCommonDirectory, 'info', 'exclude'), 'utf8')).toContain('/.worktrees/')
    await expect(cleanupWorktree(runtime, spec)).resolves.toEqual({ disposition: 'cleaned' })
    await expect(stat(spec.path)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('retains dirty or untracked output without force removal', async () => {
    const runtime = subprocess()
    const root = await repository(runtime)
    const prepared = await prepareRepository(runtime, root)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-dirty')
    await createWorktree(runtime, spec)
    await writeFile(join(spec.path, 'agent-output.txt'), 'preserve me\n')
    await expect(cleanupWorktree(runtime, spec)).resolves.toEqual({ disposition: 'retained', reason: 'worktree contains tracked or untracked changes' })
    expect(await readFile(join(spec.path, 'agent-output.txt'), 'utf8')).toBe('preserve me\n')
  })

  it('rejects repositories that track .worktrees content', async () => {
    const runtime = subprocess()
    const root = await repository(runtime)
    const prepared = await prepareRepository(runtime, root)
    await writeFile(join(root, '.gitignore'), '!/.worktrees/\n')
    await writeFile(join(root, '.worktrees'), 'tracked file\n')
    expect((await runGit(runtime, root, ['add', '-f', '.worktrees'])).exitCode).toBe(0)
    expect((await runGit(runtime, root, ['commit', '-m', 'track worktrees'])).exitCode).toBe(0)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-reject')
    await expect(createWorktree(runtime, spec)).rejects.toThrow('repository tracks .worktrees')
  })
})
