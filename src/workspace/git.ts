/** Own project-local Git worktrees and retain output when cleanup is unsafe. */

import { lstat, mkdir, open, readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'

const OUTPUT_LIMIT = 1024 * 1024
const GRACE_MS = 5_000
type GitSubprocess = Pick<SubprocessRuntime, 'resolveExecutable' | 'spawn'>

/** Complete collected output of one Git command. */
export interface GitCommandResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

/**
 * Execute Git through the configured subprocess provider, without a shell.
 * @param subprocess - Host execution provider.
 * @param cwd - Working directory.
 * @param args - Literal Git arguments.
 * @param signal - Cancellation signal.
 * @returns Complete command output; rejects lossy collection.
 */
export async function runGit(subprocess: GitSubprocess, cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitCommandResult> {
  return runExecutable(subprocess, 'git', cwd, args, signal)
}

/** @param subprocess - Native provider. @param program - Executable name. @param cwd - Authorized workspace. @param args - Literal arguments. @param signal - Lifetime. @returns Complete collected output. */
export async function runExecutable(subprocess: GitSubprocess, program: string, cwd: string, args: readonly string[], signal?: AbortSignal, env?: Readonly<Record<string, string>>): Promise<GitCommandResult> {
  signal?.throwIfAborted()
  const executable = await subprocess.resolveExecutable(program, undefined, signal)
  const handle = subprocess.spawn({
    argv: [executable, ...args], cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes: OUTPUT_LIMIT }, stderr: { maxBytes: OUTPUT_LIMIT } },
    graceMs: GRACE_MS, ...(signal === undefined ? {} : { signal }),
    ...(env === undefined ? {} : { env }),
  })
  const outcome = await handle.done
  await handle.waitForExit()
  const stdout = handle.collected.stdout?.readFrom(0)
  const stderr = handle.collected.stderr?.readFrom(0)
  if (stdout?.lossy || stderr?.lossy) throw new Error(program === 'git' ? 'Git output exceeded the collection limit; workspace state cannot be verified' : 'command output exceeded the collection limit; state cannot be verified')
  signal?.throwIfAborted()
  return { stdout: stdout?.text ?? '', stderr: stderr?.text ?? '', exitCode: outcome.exitCode }
}

async function checkedGit(subprocess: GitSubprocess, cwd: string, args: readonly string[], signal?: AbortSignal): Promise<string> {
  const result = await runGit(subprocess, cwd, args, signal)
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed with exit ${result.exitCode ?? 'signal'}`)
  return result.stdout.replace(/\r?\n$/, '')
}

/** Canonical repository identity and the commit selected for new worktrees. */
export interface PreparedRepository {
  readonly root: string
  readonly baseRevision: string
  readonly gitCommonDirectory: string
}

async function commonDirectory(subprocess: GitSubprocess, cwd: string, signal?: AbortSignal): Promise<string> {
  const common = await checkedGit(subprocess, cwd, ['rev-parse', '--git-common-dir'], signal)
  return realpath(isAbsolute(common) ? common : resolve(cwd, common))
}

/**
 * Capture a non-bare repository's identity and current commit.
 * @param subprocess - Host execution provider.
 * @param cwd - Any directory within the repository.
 * @param signal - Cancellation signal.
 * @returns Canonical root, common Git directory, and full commit hash.
 */
export async function prepareRepository(subprocess: GitSubprocess, cwd: string, signal?: AbortSignal): Promise<PreparedRepository> {
  const canonicalCwd = await realpath(cwd)
  if (!(await stat(canonicalCwd)).isDirectory()) throw new Error('base cwd must be a directory')
  if (await checkedGit(subprocess, canonicalCwd, ['rev-parse', '--is-bare-repository'], signal) !== 'false') throw new Error('antfarm requires a non-bare Git working tree')
  const root = await realpath(await checkedGit(subprocess, canonicalCwd, ['rev-parse', '--show-toplevel'], signal))
  const baseRevision = await checkedGit(subprocess, root, ['rev-parse', '--verify', 'HEAD^{commit}'], signal)
  return { root, baseRevision, gitCommonDirectory: await commonDirectory(subprocess, root, signal) }
}

function withinRoot(root: string, path: string): boolean {
  const rel = relative(root, path)
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}

function worktreePath(root: string, directory: string, runId: string): string {
  if (!isAbsolute(root) || isAbsolute(directory) || /[\0\r\n]/.test(directory)) throw new Error('worktreeDirectory must be a relative directory within the repository')
  const base = resolve(root, directory)
  if (base === root || !withinRoot(root, base)) throw new Error('worktreeDirectory must name a child directory of the repository root')
  return join(base, runId)
}

/** Deterministic path and branch reserved for one run. */
export interface WorktreeSpec {
  readonly runId: string
  readonly branch: string
  readonly path: string
  readonly repository: PreparedRepository
  readonly directory: string
}

/**
 * Resolve the run's expected worktree identity without mutating Git.
 * @param repository - Captured repository identity.
 * @param worktreeDirectory - Project-relative destination directory.
 * @param runId - Run identifier.
 * @returns Expected branch and absolute worktree path.
 */
export function resolveWorktreeSpec(repository: PreparedRepository, worktreeDirectory: string, runId: string): WorktreeSpec {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error('invalid worktree run id')
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(repository.baseRevision)) throw new Error('worktree base revision must be a full Git commit hash')
  const path = worktreePath(repository.root, worktreeDirectory, runId)
  if (withinRoot(repository.gitCommonDirectory, path) || withinRoot(join(repository.root, '.git'), path)) throw new Error('worktreeDirectory must be outside Git metadata')
  return { runId, branch: `antfarm/${runId}`, path, repository, directory: relative(repository.root, dirname(path)) }
}

async function validateSpec(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  const expected = resolveWorktreeSpec(spec.repository, spec.directory, spec.runId)
  if (spec.path !== expected.path || spec.branch !== expected.branch) throw new Error('worktree path or branch does not match its run identity')
  if (await realpath(spec.repository.root) !== spec.repository.root) throw new Error('repository root is no longer canonical')
  const root = await realpath(await checkedGit(subprocess, spec.repository.root, ['rev-parse', '--show-toplevel'], signal))
  if (root !== spec.repository.root || await commonDirectory(subprocess, root, signal) !== spec.repository.gitCommonDirectory) throw new Error('repository Git identity changed')
}

async function assertCanonicalAncestors(path: string): Promise<void> {
  let current = path
  for (;;) {
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('worktree path contains a symlink or moved directory')
      if (await realpath(current) !== current) throw new Error('worktree path contains a symlink or moved directory')
      return
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const parent = dirname(current)
      if (parent === current) throw error
      current = parent
    }
  }
}

async function rejectTrackedDirectory(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  const directory = spec.directory.split(sep).join('/')
  const ancestors = directory.split('/').map((_part, index, parts) => parts.slice(0, index + 1).join('/'))
  const tracked = await checkedGit(subprocess, spec.repository.root, ['ls-files', '-z', '--', ...ancestors.map(path => `:(literal)${path}`)], signal)
  if (tracked.split('\0').some(path => path !== '' && (path === directory || path.startsWith(`${directory}/`) || directory.startsWith(`${path}/`)))) throw new Error(`repository tracks ${directory} or its ancestor; antfarm refuses this worktree directory`)
}

async function ensureLocalExclude(spec: WorktreeSpec): Promise<void> {
  const info = join(spec.repository.gitCommonDirectory, 'info')
  const exclude = join(info, 'exclude')
  await assertCanonicalAncestors(exclude)
  await mkdir(info, { recursive: true })
  let current = ''
  try { current = await readFile(exclude, 'utf8') } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const path = spec.directory.split(sep).join('/').replace(/([\\#!*?\[\] ])/g, '\\$1')
  const pattern = `/${path}/`
  if (current.split(/\r?\n/).includes(pattern)) return
  const handle = await open(exclude, 'a')
  try {
    await handle.write(`${current !== '' && !current.endsWith('\n') ? '\n' : ''}${pattern}\n`)
    await handle.sync()
  } finally { await handle.close() }
}

/**
 * Create a new worktree after verifying repository, destination, and branch ownership.
 * @param subprocess - Host execution provider.
 * @param spec - Expected run worktree.
 * @param signal - Cancellation signal.
 */
export async function createWorktree(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  await validateSpec(subprocess, spec, signal)
  await rejectTrackedDirectory(subprocess, spec, signal)
  await assertCanonicalAncestors(spec.path)
  try {
    await lstat(spec.path)
    throw new Error('worktree destination already exists')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await ensureLocalExclude(spec)
  await mkdir(dirname(spec.path), { recursive: true })
  await assertCanonicalAncestors(dirname(spec.path))
  await mkdir(spec.path)
  await checkedGit(subprocess, spec.repository.root, ['worktree', 'add', '-b', spec.branch, spec.path, spec.repository.baseRevision], signal)
  await validateWorktree(subprocess, spec, signal)
}

/**
 * Verify a retained worktree's path, Git repository, branch, and base ancestry.
 * @param subprocess - Host execution provider.
 * @param spec - Journal-recorded run worktree.
 * @param signal - Cancellation signal.
 */
export async function validateWorktree(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void> {
  await validateSpec(subprocess, spec, signal)
  if (await realpath(spec.path) !== spec.path) throw new Error('worktree path is no longer canonical')
  const root = await realpath(await checkedGit(subprocess, spec.path, ['rev-parse', '--show-toplevel'], signal))
  if (root !== spec.path || await commonDirectory(subprocess, spec.path, signal) !== spec.repository.gitCommonDirectory) throw new Error('worktree belongs to a different Git repository')
  const branch = await runGit(subprocess, spec.path, ['symbolic-ref', '--quiet', '--short', 'HEAD'], signal)
  if (branch.exitCode !== 0 || branch.stdout.trim() !== spec.branch) throw new Error(`worktree branch changed or is detached; expected ${spec.branch}`)
  if ((await runGit(subprocess, spec.path, ['merge-base', '--is-ancestor', spec.repository.baseRevision, 'HEAD'], signal)).exitCode !== 0) throw new Error('worktree HEAD no longer descends from its recorded base revision')
}

/** Outcome of clean-only worktree removal. */
export interface WorktreeCleanupResult {
  readonly disposition: 'cleaned' | 'retained'
  readonly reason?: string
}

/**
 * Remove only an unchanged worktree whose complete identity still matches the run.
 * @param subprocess - Host execution provider.
 * @param spec - Journal-recorded run worktree.
 * @returns Retained on identity mismatch, tracked/untracked changes, or Git failure.
 */
export async function cleanupWorktree(subprocess: GitSubprocess, spec: WorktreeSpec): Promise<WorktreeCleanupResult> {
  try {
    await validateWorktree(subprocess, spec)
    const status = await checkedGit(subprocess, spec.path, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored=matching'])
    if (status !== '') return { disposition: 'retained', reason: 'worktree contains tracked or untracked changes' }
    await checkedGit(subprocess, spec.repository.root, ['worktree', 'remove', spec.path])
    return { disposition: 'cleaned' }
  } catch (error: unknown) {
    return { disposition: 'retained', reason: error instanceof Error ? error.message : String(error) }
  }
}
