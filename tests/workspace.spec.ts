import { spawn } from 'node:child_process'
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { SubprocessHandle, SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it, onTestFinished } from 'vitest'
import { cleanupWorktree, createWorktree, prepareRepository, resolveWorktreeSpec, runGit, validateWorktree } from '../src/workspace/git.ts'

type GitSubprocess = Pick<SubprocessRuntime, 'resolveExecutable' | 'spawn'>

async function fixture() {
  const temporary = await mkdtemp(join(tmpdir(), 'antfarm-workspace-'))
  const handles = new Set<SubprocessHandle>()
  onTestFinished(async () => {
    for (const handle of handles) handle.terminate()
    await Promise.allSettled([...handles].map(handle => handle.waitForExit()))
    await rm(temporary, { recursive: true, force: true })
  })
  const root = join(temporary, 'repository')
  await mkdir(root)
  const globalConfig = join(temporary, 'gitconfig')
  await writeFile(globalConfig, '')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  const runtime: GitSubprocess = {
    async resolveExecutable(command) { return command },
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
      const child = spawn(spec.argv[0]!, spec.argv.slice(1), {
        cwd: spec.cwd, signal: spec.signal, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...env, ...spec.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: globalConfig },
      })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      child.stdout.on('data', chunk => { stdout.push(Buffer.from(chunk)) })
      child.stderr.on('data', chunk => { stderr.push(Buffer.from(chunk)) })
      const done = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once('error', reject)
        child.once('close', (exitCode, signal) => { resolve({ exitCode, signal }) })
      })
      const reader = (chunks: Buffer[], maxBytes: number) => ({
        readFrom(offset: number) {
          const data = Buffer.concat(chunks)
          const start = Math.max(offset, data.length - maxBytes)
          return { text: data.subarray(start).toString('utf8'), nextOffset: data.length, lossy: start > offset }
        },
      })
      const maxBytes = (mode: SubprocessSpawnSpec['stdio']['stdout']) => typeof mode === 'object' ? mode.maxBytes : Number.MAX_SAFE_INTEGER
      const handle: SubprocessHandle = {
        stdin: undefined, stdout: undefined, stderr: undefined, control: undefined,
        collected: { stdout: reader(stdout, maxBytes(spec.stdio.stdout)), stderr: reader(stderr, maxBytes(spec.stdio.stderr)) },
        done, terminate: () => { child.kill('SIGTERM') },
        async waitForExit() { await done; return true },
      }
      handles.add(handle)
      void done.then(() => { handles.delete(handle) }, () => { handles.delete(handle) })
      return handle
    },
  }
  const git = async (cwd: string, args: readonly string[]) => {
    const result = await runGit(runtime, cwd, args)
    expect(result.exitCode, result.stderr).toBe(0)
    return result.stdout.trim()
  }
  const initialize = async (cwd: string, branch = 'main') => {
    await git(cwd, ['init', '-b', branch])
    await git(cwd, ['config', 'user.email', 'antfarm@example.test'])
    await git(cwd, ['config', 'user.name', 'Antfarm Test'])
    await git(cwd, ['config', 'core.hooksPath', join(temporary, 'no-hooks')])
    await writeFile(join(cwd, 'README.md'), 'base\n')
    await git(cwd, ['add', 'README.md'])
    await git(cwd, ['commit', '-m', 'base'])
  }
  await initialize(root)
  const prepared = await prepareRepository(runtime, root)
  const spec = (id = 'af-test', directory = '.worktrees/antfarm') => resolveWorktreeSpec(prepared, directory, id)
  return { temporary, root: prepared.root, runtime, prepared, spec, git, initialize }
}

describe('owned project worktrees', () => {
  it('creates a clean worktree in the configured directory and leaves its committed branch after cleanup', async () => {
    const test = await fixture()
    const spec = test.spec('af-clean', 'generated worktrees/runs')
    await createWorktree(test.runtime, spec)
    await expect(validateWorktree(test.runtime, spec)).resolves.toBeUndefined()
    expect(await test.git(test.root, ['status', '--porcelain'])).toBe('')
    expect(await readFile(join(test.prepared.gitCommonDirectory, 'info', 'exclude'), 'utf8')).toContain('/generated\\ worktrees/runs/')
    await writeFile(join(spec.path, 'README.md'), 'implemented\n')
    await test.git(spec.path, ['add', 'README.md'])
    await test.git(spec.path, ['commit', '-m', 'implementation'])
    const committed = await test.git(spec.path, ['rev-parse', 'HEAD'])
    await expect(cleanupWorktree(test.runtime, spec)).resolves.toEqual({ disposition: 'cleaned' })
    await expect(lstat(spec.path)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await test.git(test.root, ['rev-parse', `refs/heads/${spec.branch}`])).toBe(committed)
  })

  it.each(['tracked', 'untracked', 'ignored'])('retains %s output', async kind => {
    const test = await fixture()
    if (kind === 'ignored') {
      await writeFile(join(test.root, '.gitignore'), 'output.txt\n')
      await test.git(test.root, ['add', '.gitignore'])
      await test.git(test.root, ['commit', '-m', 'ignore output'])
    }
    const prepared = await prepareRepository(test.runtime, test.root)
    const spec = resolveWorktreeSpec(prepared, '.worktrees/antfarm', 'af-output')
    await createWorktree(test.runtime, spec)
    const file = kind === 'tracked' ? 'README.md' : 'output.txt'
    await writeFile(join(spec.path, file), 'preserve this output\n')
    await expect(cleanupWorktree(test.runtime, spec)).resolves.toEqual({ disposition: 'retained', reason: 'worktree contains tracked or untracked changes' })
    expect(await readFile(join(spec.path, file), 'utf8')).toBe('preserve this output\n')
  })

  it('checks configured tracked paths and ancestor files before making a worktree', async () => {
    const test = await fixture()
    await writeFile(join(test.root, 'custom'), 'tracked ancestor\n')
    await test.git(test.root, ['add', 'custom'])
    const ancestor = test.spec('af-ancestor', 'custom/runs')
    await expect(createWorktree(test.runtime, ancestor)).rejects.toThrow('repository tracks custom/runs or its ancestor')
    await mkdir(join(test.root, 'generated'), { recursive: true })
    await writeFile(join(test.root, 'generated', 'tracked.txt'), 'tracked directory output\n')
    await test.git(test.root, ['add', 'generated/tracked.txt'])
    await expect(createWorktree(test.runtime, test.spec('af-tracked', 'generated'))).rejects.toThrow('repository tracks generated or its ancestor')
    expect(await test.git(test.root, ['for-each-ref', '--format=%(refname)', 'refs/heads/antfarm'])).toBe('')
  })

  it('does not reject tracked siblings of the configured directory', async () => {
    const test = await fixture()
    await mkdir(join(test.root, 'generated', 'maintained'), { recursive: true })
    await writeFile(join(test.root, 'generated', 'maintained', 'source.txt'), 'source\n')
    await test.git(test.root, ['add', 'generated/maintained/source.txt'])
    const spec = test.spec('af-sibling', 'generated/runs')
    await expect(createWorktree(test.runtime, spec)).resolves.toBeUndefined()
  })

  it('does not claim a pre-existing destination', async () => {
    const test = await fixture()
    const spec = test.spec('af-existing')
    await mkdir(spec.path, { recursive: true })
    await expect(createWorktree(test.runtime, spec)).rejects.toThrow('destination already exists')
    expect(await readdir(spec.path)).toEqual([])
    expect(await test.git(test.root, ['for-each-ref', '--format=%(refname)', `refs/heads/${spec.branch}`])).toBe('')
  })

  it('retains a run worktree after its branch changes or becomes detached', async () => {
    const test = await fixture()
    const spec = test.spec('af-branch')
    await createWorktree(test.runtime, spec)
    await test.git(spec.path, ['switch', '-c', 'manual-branch'])
    await expect(validateWorktree(test.runtime, spec)).rejects.toThrow('branch changed or is detached')
    expect((await cleanupWorktree(test.runtime, spec)).disposition).toBe('retained')
    await test.git(spec.path, ['checkout', '--detach'])
    await expect(validateWorktree(test.runtime, spec)).rejects.toThrow('branch changed or is detached')
    expect((await lstat(spec.path)).isDirectory()).toBe(true)
  })

  it('rejects a substituted worktree from another Git repository', async () => {
    const test = await fixture()
    const spec = test.spec('af-substituted')
    await mkdir(spec.path, { recursive: true })
    await test.initialize(spec.path, spec.branch)
    await expect(validateWorktree(test.runtime, spec)).rejects.toThrow('different Git repository')
    expect((await cleanupWorktree(test.runtime, spec)).disposition).toBe('retained')
    expect(await readFile(join(spec.path, 'README.md'), 'utf8')).toBe('base\n')
  })

  it('rejects a recorded base that is not an ancestor of the retained HEAD', async () => {
    const test = await fixture()
    const spec = test.spec('af-base')
    await createWorktree(test.runtime, spec)
    await writeFile(join(test.root, 'README.md'), 'later base\n')
    await test.git(test.root, ['add', 'README.md'])
    await test.git(test.root, ['commit', '-m', 'later base'])
    const newBase = await prepareRepository(test.runtime, test.root)
    const mismatched = { ...spec, repository: newBase }
    await expect(validateWorktree(test.runtime, mismatched)).rejects.toThrow('no longer descends')
    expect((await cleanupWorktree(test.runtime, mismatched)).disposition).toBe('retained')
  })

  it('rejects altered paths, branches, and common Git directories before cleanup', async () => {
    const test = await fixture()
    const spec = test.spec('af-identity')
    await createWorktree(test.runtime, spec)
    for (const altered of [
      { ...spec, path: test.root },
      { ...spec, branch: 'main' },
      { ...spec, repository: { ...spec.repository, gitCommonDirectory: test.temporary } },
    ]) expect((await cleanupWorktree(test.runtime, altered)).disposition).toBe('retained')
    expect((await lstat(spec.path)).isDirectory()).toBe(true)
  })

  // Windows symbolic links require host privileges that Git fixtures do not own.
  it.skipIf(process.platform === 'win32')('rejects a configured destination symlink and a substituted run path', async () => {
    const test = await fixture()
    const outside = join(test.temporary, 'outside')
    await mkdir(outside)
    await symlink(outside, join(test.root, 'linked'), 'dir')
    await expect(createWorktree(test.runtime, test.spec('af-link', 'linked/runs'))).rejects.toThrow('symlink')
    expect(await readdir(outside)).toEqual([])
    const spec = test.spec('af-path')
    await mkdir(join(test.root, '.worktrees', 'antfarm'), { recursive: true })
    await symlink(outside, spec.path, 'dir')
    await expect(validateWorktree(test.runtime, spec)).rejects.toThrow('no longer canonical')
    expect((await cleanupWorktree(test.runtime, spec)).disposition).toBe('retained')
    expect(await readdir(outside)).toEqual([])
  })

  it('rejects escaping directories and ambiguous base revisions', async () => {
    const test = await fixture()
    for (const directory of ['.', '../outside', '/tmp/outside', 'runs\nother']) expect(() => test.spec('af-escape', directory)).toThrow('worktreeDirectory')
    expect(() => resolveWorktreeSpec({ ...test.prepared, baseRevision: '--all' }, '.worktrees', 'af-base')).toThrow('full Git commit hash')
    expect(() => test.spec('af-metadata', '.git/runs')).toThrow('outside Git metadata')
  })

  it('retains the worktree when Git status collection loses output', async () => {
    const test = await fixture()
    const spec = test.spec('af-lossy')
    await createWorktree(test.runtime, spec)
    const lossy: GitSubprocess = {
      ...test.runtime,
      spawn(request) {
        const handle = test.runtime.spawn(request)
        if (!request.argv.includes('status')) return handle
        return {
          ...handle,
          collected: { ...handle.collected, stdout: { readFrom: () => ({ text: '', nextOffset: 2 * 1024 * 1024, lossy: true }) } },
        }
      },
    }
    await expect(cleanupWorktree(lossy, spec)).resolves.toEqual({ disposition: 'retained', reason: 'Git output exceeded the collection limit; workspace state cannot be verified' })
    expect((await lstat(spec.path)).isDirectory()).toBe(true)
  })
})
