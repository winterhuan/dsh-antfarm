/** Owned non-Git workspaces and retained content-addressed output snapshots. */
import { createHash } from 'node:crypto'
import { lstat, mkdir, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

import type { FileInput, FileArtifact } from '../persistence/types.ts'

function confined(root: string, path: string): string {
  const target = resolve(root, path)
  const rel = relative(root, target)
  if (isAbsolute(rel) || rel === '..' || rel === '' || rel.startsWith(`..${sep}`)) throw new Error('file workspace resource escapes its owned root')
  return target
}

/** @param base - Authorized input root. @param paths - Explicit relative UTF-8 inputs. @returns Bounded snapshots. */
export async function captureFileInputs(base: string, paths: readonly string[]): Promise<FileInput[]> {
  const canonical = await realpath(base)
  if (paths.length > 100) throw new Error('file workflow accepts at most 100 explicit inputs')
  const inputs: FileInput[] = []
  let bytes = 0
  for (const path of paths) {
    if (isAbsolute(path)) throw new Error('file workflow inputs must be relative to its input root')
    const source = await realpath(confined(canonical, path))
    confined(canonical, relative(canonical, source))
    const content = await readFile(source)
    bytes += content.length
    if (bytes > 1024 * 1024) throw new Error('file workflow inputs exceed 1 MiB')
    const text = content.toString('utf8')
    if (!Buffer.from(text).equals(content)) throw new Error('file workflow inputs must be UTF-8 text')
    inputs.push({ path, sha256: createHash('sha256').update(content).digest('hex'), content: text })
  }
  return inputs
}

/** @param base - Original input root. @param runId - Run identity. @returns Owned output workspace path. */
export function fileWorkspacePath(base: string, runId: string): string { return confined(base, join('.antfarm/runs', runId)) }

/**
 * Create a new owned workspace using saved input bytes, without modifying source inputs.
 * @param workspace - Run's recorded output directory.
 * @param runId - Ownership marker identity.
 * @param inputs - Immutable input snapshots from admission.
 */
export async function createFileWorkspace(workspace: string, runId: string, inputs: readonly FileInput[]): Promise<void> {
  let ancestor = dirname(workspace)
  for (;;) {
    try { if (await realpath(ancestor) !== ancestor) throw new Error('file workspace ancestors must not be symbolic links'); break }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; ancestor = dirname(ancestor) }
  }
  await mkdir(dirname(workspace), { recursive: true })
  await mkdir(workspace)
  await writeFile(join(workspace, '.antfarm-owner.json'), JSON.stringify({ runId, workspace }), { flag: 'wx', mode: 0o600 })
  for (const input of inputs) {
    if (createHash('sha256').update(input.content).digest('hex') !== input.sha256) throw new Error('saved input snapshot does not match its digest')
    const path = confined(join(workspace, 'inputs'), input.path)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, input.content, { flag: 'wx', mode: 0o400 })
  }
}

/** @param workspace - Retained directory. @param runId - Original owner. */
export async function validateFileWorkspace(workspace: string, runId: string): Promise<void> {
  if (await realpath(workspace) !== workspace) throw new Error('file workspace moved or became a symbolic link')
  const marker = join(workspace, '.antfarm-owner.json')
  if ((await lstat(marker)).isSymbolicLink()) throw new Error('file workspace marker must not be a symbolic link')
  const value: unknown = JSON.parse(await readFile(marker, 'utf8'))
  if (value === null || typeof value !== 'object' || !('runId' in value) || !('workspace' in value) || value.runId !== runId || value.workspace !== workspace) throw new Error('file workspace ownership does not match')
}

/** @param root - Owned workspace. @returns Relative regular files; links and oversized trees refuse. */
export async function fileInventory(root: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isSymbolicLink()) throw new Error('file workflow outputs must not contain symbolic links')
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && entry.name !== '.antfarm-owner.json') files.push(relative(root, path))
      if (files.length > 1000) throw new Error('file workflow output exceeds 1000 files')
    }
  }
  await visit(root)
  return files.sort()
}

/** @param root - Owned directory. @returns Content identity of all current files. */
export async function fileCandidateVersion(root: string): Promise<string> {
  const hash = createHash('sha256')
  for (const name of await fileInventory(root)) {
    const bytes = await readFile(confined(root, name))
    if (bytes.length > 16 * 1024 * 1024) throw new Error('file workflow artifact exceeds 16 MiB')
    hash.update(JSON.stringify(name)); hash.update(bytes)
  }
  return hash.digest('hex')
}

/** @param root - Owned workspace. @param destination - Private Run evidence directory. @returns Immutable output references. */
export async function retainFileOutputs(root: string, destination: string): Promise<FileArtifact[]> {
  await mkdir(destination, { recursive: true })
  const artifacts: FileArtifact[] = []
  for (const path of await fileInventory(root)) {
    if (path.startsWith(`inputs${sep}`)) continue
    const bytes = await readFile(confined(root, path))
    if (bytes.length > 16 * 1024 * 1024) throw new Error('file workflow artifact exceeds 16 MiB')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const output = join(destination, sha256)
    let file
    try { file = await open(output, 'wx', 0o400) }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; if (!bytes.equals(await readFile(output))) throw new Error('retained output digest differs'); artifacts.push({ path, sha256, bytes: bytes.length }); continue }
    try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
    artifacts.push({ path, sha256, bytes: bytes.length })
  }
  return artifacts
}
