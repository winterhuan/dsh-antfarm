import { copyFile, mkdir, open, readFile, realpath, stat, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'

const OUTPUT_LIMIT = 1024 * 1024
const GRACE_MS = 5_000

export interface GitCommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

/** Run one argv-only Git command through the host execution world. */
export async function runGit(
  subprocess: SubprocessRuntime,
  cwd: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<GitCommandResult> {
  const git = await subprocess.resolveExecutable('git', undefined, signal)
  const handle = subprocess.spawn({
    argv: [git, ...args],
    cwd,
    stdio: {
      stdin: 'ignore',
      stdout: { maxBytes: OUTPUT_LIMIT },
      stderr: { maxBytes: OUTPUT_LIMIT },
    },
    graceMs: GRACE_MS,
    ...(signal === undefined ? {} : { signal }),
  })
  const outcome = await handle.done
  return {
    stdout: handle.collected.stdout?.readFrom(0).text ?? '',
    stderr: handle.collected.stderr?.readFrom(0).text ?? '',
    exitCode: outcome.exitCode,
  }
}

async function checkedGit(subprocess: SubprocessRuntime, cwd: string, args: readonly string[], signal?: AbortSignal): Promise<string> {
  const result = await runGit(subprocess, cwd, args, signal)
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode ?? 'signal'}`
    throw new Error(`git ${args.join(' ')} failed: ${detail}`)
  }
  return result.stdout.trim()
}

export interface PreparedRepository {
  readonly root: string
  readonly baseRevision: string
  readonly baseStatus: string
  readonly gitCommonDirectory: string
}

/** Resolve and validate the repository facts needed before a job is committed. */
export async function prepareRepository(subprocess: SubprocessRuntime, cwd: string, signal?: AbortSignal): Promise<PreparedRepository> {
  const canonicalCwd = await realpath(cwd)
  if (!(await stat(canonicalCwd)).isDirectory()) throw new Error(`base cwd is not a directory: ${canonicalCwd}`)
  const root = await realpath(await checkedGit(subprocess, canonicalCwd, ['rev-parse', '--show-toplevel'], signal))
  const bare = await checkedGit(subprocess, root, ['rev-parse', '--is-bare-repository'], signal)
  if (bare !== 'false') throw new Error(`antfarm requires a non-bare Git working tree: ${root}`)
  const baseRevision = await checkedGit(subprocess, root, ['rev-parse', 'HEAD'], signal)
  const baseStatus = await checkedGit(subprocess, root, ['status', '--porcelain=v1', '--untracked-files=all'], signal)
  const rawCommon = await checkedGit(subprocess, root, ['rev-parse', '--git-common-dir'], signal)
  const gitCommonDirectory = await realpath(isAbsolute(rawCommon) ? rawCommon : resolve(root, rawCommon))
  return { root, baseRevision, baseStatus, gitCommonDirectory }
}

function resolveWorktree(root: string, directory: string, runId: string): string {
  if (isAbsolute(directory)) throw new Error('worktreeDirectory must be relative to the repository root')
  const base = resolve(root, directory)
  const rel = relative(root, base)
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel === '') throw new Error('worktreeDirectory must name a child directory of the repository root')
  return join(base, runId)
}

async function ensureLocalExclude(gitCommonDirectory: string, worktreeDirectory: string): Promise<void> {
  const exclude = join(gitCommonDirectory, 'info', 'exclude')
  await mkdir(dirname(exclude), { recursive: true })
  let current = ''
  try {
    current = await readFile(exclude, 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const relativeDirectory = `/${worktreeDirectory.replaceAll('\\', '/').replace(/\/+$/, '')}/`
  if (current.split(/\r?\n/).some(line => line.trim() === relativeDirectory)) return
  const handle = await open(exclude, 'a')
  try {
    if (current !== '' && !current.endsWith('\n')) await handle.write('\n')
    await handle.write(`# dsh-antfarm managed worktrees\n${relativeDirectory}\n`)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export interface WorktreeSpec {
  readonly runId: string
  readonly branch: string
  readonly path: string
  readonly repository: PreparedRepository
  readonly directory: string
}

/** Reserve the deterministic path and branch for one run without mutating Git. */
export function resolveWorktreeSpec(repository: PreparedRepository, worktreeDirectory: string, runId: string): WorktreeSpec {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error(`invalid run id: ${runId}`)
  return { runId, branch: `antfarm/${runId}`, path: resolveWorktree(repository.root, worktreeDirectory, runId), repository, directory: worktreeDirectory }
}

/** Create one owned Git worktree and its run branch. */
export async function createWorktree(subprocess: SubprocessRuntime, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  const tracked = await runGit(subprocess, spec.repository.root, ['ls-files', '.worktrees'], signal)
  if (tracked.exitCode !== 0) throw new Error(tracked.stderr.trim() || 'unable to inspect tracked .worktrees paths')
  if (tracked.stdout.trim() !== '') throw new Error('repository tracks .worktrees; antfarm refuses to place generated worktrees there')
  await ensureLocalExclude(spec.repository.gitCommonDirectory, spec.directory)
  await mkdir(dirname(spec.path), { recursive: true })
  await checkedGit(subprocess, spec.repository.root, ['worktree', 'add', '-b', spec.branch, spec.path, spec.repository.baseRevision], signal)
}

export interface WorktreeCleanupResult {
  readonly disposition: 'cleaned' | 'retained'
  readonly reason?: string
}

/** Remove an owned worktree only when Git reports no tracked or untracked changes. */
export async function cleanupWorktree(subprocess: SubprocessRuntime, spec: WorktreeSpec): Promise<WorktreeCleanupResult> {
  let status: GitCommandResult
  try {
    status = await runGit(subprocess, spec.path, ['status', '--porcelain=v1', '--untracked-files=all'])
  } catch (error: unknown) {
    return { disposition: 'retained', reason: error instanceof Error ? error.message : String(error) }
  }
  if (status.exitCode !== 0) return { disposition: 'retained', reason: status.stderr.trim() || 'unable to inspect worktree status' }
  if (status.stdout !== '') return { disposition: 'retained', reason: 'worktree contains tracked or untracked changes' }
  const removed = await runGit(subprocess, spec.repository.root, ['worktree', 'remove', spec.path])
  if (removed.exitCode !== 0) return { disposition: 'retained', reason: removed.stderr.trim() || 'git worktree remove failed' }
  await runGit(subprocess, spec.repository.root, ['worktree', 'prune'])
  return { disposition: 'cleaned' }
}

/** Copy explicitly configured environment files into an owned worktree. */
export async function copyWorktreeFiles(files: readonly string[], repositoryRoot: string, workspace: string): Promise<readonly string[]> {
  const copied: string[] = []
  for (const file of files) {
    if (isAbsolute(file)) throw new Error(`envFiles entry must be relative to the repository root: ${file}`)
    const source = resolve(repositoryRoot, file)
    const relativeSource = relative(repositoryRoot, source)
    if (relativeSource === '..' || relativeSource.startsWith(`..${sep}`)) throw new Error(`envFiles entry escapes the repository root: ${file}`)
    const destination = resolve(workspace, file)
    const relativeDestination = relative(workspace, destination)
    if (relativeDestination === '..' || relativeDestination.startsWith(`..${sep}`)) throw new Error(`envFiles entry escapes the worktree: ${file}`)
    if (!(await stat(source)).isFile()) throw new Error(`envFiles entry is not a file: ${file}`)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
    copied.push(destination)
  }
  return copied
}

/** Remove only generated files owned by this run before clean-only cleanup. */
export async function removeWorktreeFiles(files: readonly string[]): Promise<void> {
  for (const file of files) {
    try {
      await unlink(file)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}

/** Verify a retained worktree still points at the run's branch and base. */
export async function validateWorktree(subprocess: SubprocessRuntime, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  const actualPath = await realpath(spec.path)
  if (actualPath !== resolve(spec.path)) throw new Error(`worktree path resolves outside its recorded path: ${actualPath}`)
  const branch = await checkedGit(subprocess, spec.path, ['branch', '--show-current'], signal)
  if (branch !== spec.branch) throw new Error(`worktree branch is ${branch}, expected ${spec.branch}`)
  const base = await runGit(subprocess, spec.path, ['merge-base', '--is-ancestor', spec.repository.baseRevision, 'HEAD'], signal)
  if (base.exitCode !== 0) throw new Error(`worktree HEAD no longer descends from base revision ${spec.repository.baseRevision}`)
}
