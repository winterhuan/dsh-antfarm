/** Candidate diff detection and immutable screenshot retention for frontend checks. */
import { createHash } from 'node:crypto'
import { mkdir, open, readFile, realpath } from 'node:fs/promises'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type { CheckEvidence, FileArtifact, RunStartData } from '../persistence/types.ts'
import { runGit } from '../workspace/git.ts'

const extensions = new Set(['.html', '.css', '.scss', '.less', '.jsx', '.tsx', '.vue', '.svelte'])
const directories = ['public/', 'static/', 'assets/', 'components/', 'pages/', 'views/', 'styles/']

/** @param files - Actual changed paths. @returns Frontend paths, excluding test files. */
export function frontendPaths(files: readonly string[]): string[] {
  return files.filter(file => !['.test.', '.spec.', '__tests__/'].some(pattern => file.includes(pattern)) && (extensions.has(extname(file).toLowerCase()) || directories.some(directory => file.replaceAll('\\', '/').includes(`/${directory}`) || file.startsWith(directory))))
}

/** @param subprocess - Native provider. @param start - Owned Git candidate. @param signal - Run lifetime. @returns Diff paths with frontend effects. */
export async function changedFrontendPaths(subprocess: SubprocessRuntime, start: RunStartData, signal: AbortSignal): Promise<string[]> {
  if (start.workspaceKind === 'files') return []
  const result = await runGit(subprocess, start.workspace, ['diff', '--name-only', '-z', start.baseRevision, '--'], signal)
  if (result.exitCode !== 0) throw new Error('frontend candidate diff could not be inspected')
  return frontendPaths(result.stdout.split('\0').filter(Boolean))
}

/** @param workspace - Owned candidate. @param paths - Claimed screenshots. @param records - Native browser commands. @param candidate - Checked version. @param destination - Private artifacts. @returns Retained image references. */
export async function retainScreenshots(workspace: string, paths: readonly string[], records: readonly CheckEvidence[], candidate: string, destination: string): Promise<FileArtifact[]> {
  if (paths.length === 0 || paths.length > 10 || !records.some(record => record.passed && record.candidate === candidate && record.afterCandidate === candidate && /^(?:pnpm exec |npx )?(?:playwright|puppeteer|cypress|ego-browser)\b/.test(record.command))) throw new Error('frontend acceptance requires successful native browser execution and one to ten screenshots')
  await mkdir(destination, { recursive: true })
  const artifacts: FileArtifact[] = []
  for (const path of paths) {
    if (isAbsolute(path)) throw new Error('screenshot path must be relative to the owned workspace')
    const source = await realpath(resolve(workspace, path))
    const rel = relative(workspace, source)
    if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('screenshot escapes the owned workspace')
    const bytes = await readFile(source)
    if (bytes.length > 16 * 1024 * 1024 || !(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))) throw new Error('screenshot must be a PNG or JPEG of at most 16 MiB')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    let file
    try { file = await open(join(destination, sha256), 'wx', 0o400) }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; if (!bytes.equals(await readFile(join(destination, sha256)))) throw new Error('retained screenshot integrity differs') }
    if (file !== undefined) { try { await file.writeFile(bytes); await file.sync() } finally { await file.close() } }
    artifacts.push({ path, sha256, bytes: bytes.length })
  }
  return artifacts
}
