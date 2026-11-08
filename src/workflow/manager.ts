/** Validated, revision-checked workflow copies in writable user roots. */
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parse, stringify } from 'yaml'
import { loadWorkflow, validateResolvedWorkflow } from './loader.ts'
import { importOriginalWorkflow } from './original.ts'
import type { ResolvedWorkflow } from './types.ts'

import type { WorkflowDraft } from './types.ts'
export type { WorkflowDraft } from './types.ts'

const safeId = (id: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('workflow id must be kebab-case')
  return id
}
function child(root: string, name: string): string {
  const target = resolve(root, name)
  const rel = relative(root, target)
  if (isAbsolute(rel) || rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('workflow file must be a child of its writable directory')
  return target
}

/** @param cwd - Canonical project input root. @returns Project registry path confined through existing ancestors. */
export async function projectWorkflowRoot(cwd: string): Promise<string> {
  const root = await realpath(cwd)
  const target = join(root, '.antfarm/workflows')
  let ancestor = target
  while (ancestor !== root) {
    try { child(root, await realpath(ancestor)); return target }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; ancestor = dirname(ancestor) }
  }
  return target
}
function draft(workflow: ResolvedWorkflow): WorkflowDraft {
  const { sourceDirectory, ...definition } = workflow
  const files = Object.fromEntries(workflow.agents.map(agent => [`agents/${agent.id}.md`, agent.instructions]))
  const document = stringify({ ...definition, agents: workflow.agents.map(agent => ({ ...agent, instructions: `agents/${agent.id}.md` })) })
  const revision = createHash('sha256').update(JSON.stringify({ document, files })).digest('hex')
  return { id: workflow.id, document, files, revision, sourceDirectory }
}

/** A single Host serializes workflow effects while Run snapshots remain immutable. */
export class WorkflowManager {
  private writing: Promise<void> = Promise.resolve()

  /** @param packageRoot - Last-precedence read-only workflow root. */
  constructor(private readonly packageRoot: string) {}

  /** @param roots - Roots in precedence order. @returns Discoverable workflow ids. */
  async list(roots: readonly string[]): Promise<string[]> {
    const ids = new Set<string>()
    for (const root of [...roots, this.packageRoot]) {
      let entries
      try { entries = await readdir(root, { withFileTypes: true }) }
      catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue; throw error }
      for (const entry of entries) if (entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) {
        try { await lstat(join(root, entry.name, 'workflow.yml')); ids.add(entry.name) }
        catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error }
      }
    }
    return [...ids].sort()
  }

  /** @param id - Selected workflow. @param roots - User roots. @returns Validated editable copy. */
  async read(id: string, roots: readonly string[]): Promise<WorkflowDraft> {
    return { ...draft(await loadWorkflow(safeId(id), [...roots, this.packageRoot])), enabled: await this.enabled(id, roots) }
  }

  /** @param id - Workflow identity. @param roots - Explicit user roots. @returns Enablement from owned marker files. */
  async enabled(id: string, roots: readonly string[]): Promise<boolean> {
    for (const root of roots) {
      const path = join(root, '.disabled', safeId(id))
      try { const marker = await lstat(path); if (!marker.isFile() || marker.isSymbolicLink()) throw new Error('workflow enablement marker must be a regular file'); return false }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error }
    }
    return true
  }

  /** @param id - Workflow identity. @param roots - Source roots. @param enabled - Desired state. @param expected - Previously observed state. */
  setEnabled(id: string, roots: readonly string[], enabled: boolean, expected: boolean, revision?: string): Promise<void> {
    return this.serialize(async () => {
      const current = await this.read(id, roots)
      if (revision !== undefined && current.revision !== revision) throw new Error('workflow source changed; reload before applying this operation')
      if (await this.enabled(id, roots) !== expected) throw new Error('workflow enablement changed; reload before applying this operation')
      if (enabled === expected) return
      const root = roots[0]
      if (root === undefined) throw new Error('no writable workflow registry root')
      await mkdir(root, { recursive: true })
      const canonical = await realpath(root)
      const directory = join(canonical, '.disabled')
      await mkdir(directory, { recursive: true })
      if (await realpath(directory) !== directory) throw new Error('workflow enablement directory must not be a symbolic link')
      const marker = join(directory, safeId(id))
      if (enabled) {
        await rm(marker, { force: true })
        if (!await this.enabled(id, roots)) throw new Error('workflow is disabled by a profile marker; enable it in that scope')
      } else await writeFile(marker, 'disabled\n', { flag: 'wx', mode: 0o600 })
    })
  }

  /** @param source - Revision-bound source. @param newId - New workflow id. @param roots - Effective roots. @param root - Destination. @returns New validated copy. */
  copy(source: WorkflowDraft, newId: string, roots: readonly string[], root: string): Promise<WorkflowDraft> {
    return this.serialize(async () => {
      const current = await this.read(source.id, roots)
      if (current.revision !== source.revision) throw new Error('workflow changed; reload before copying it')
      if ((await this.list(roots)).includes(safeId(newId))) throw new Error('workflow id already exists')
      const definition: unknown = parse(source.document)
      if (definition === null || typeof definition !== 'object' || Array.isArray(definition)) throw new Error('workflow copy requires an object definition')
      return this.install(newId, stringify({ ...definition, id: newId }), source.files, root, true)
    })
  }

  /**
   * Save a self-contained copy with an atomic definition replacement after validating references and source revision.
   * @param value - Draft contents; the revision must match the currently inherited source.
   * @param root - Authorized writable root, never the package root.
   * @param roots - Current effective roots in precedence order.
   * @returns Saved draft with its new revision.
   */
  save(value: WorkflowDraft, root: string, roots: readonly string[]): Promise<WorkflowDraft> {
    return this.serialize(async () => {
      const current = await this.read(value.id, roots)
      if (current.revision !== value.revision) throw new Error('workflow changed; reload before saving your draft')
      try {
        await lstat(join(root, value.id, 'workflow.yml'))
        const destination = await this.read(value.id, [root])
        if (destination.sourceDirectory !== current.sourceDirectory) throw new Error('another workflow copy exists at this save location; open that source before replacing it')
      } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error }
      return this.install(value.id, value.document, value.files, root)
    })
  }

  /**
   * Import original resources into a new writable workflow; an existing id refuses.
   * @param directory - Original workflow directory.
   * @param sourceRoot - Explicit root containing its shared files.
   * @param root - Authorized destination.
   * @returns Self-contained native workflow copy.
   */
  import(directory: string, sourceRoot: string, root: string, workspace: 'git' | 'files' = 'git'): Promise<WorkflowDraft> {
    return this.serialize(async () => {
      const canonical = await realpath(directory)
      const path = await realpath(join(canonical, 'workflow.yml'))
      if (path !== join(canonical, 'workflow.yml')) throw new Error('import document must not be a symbolic link')
      const workflow = validateResolvedWorkflow(await importOriginalWorkflow(await readFile(path, 'utf8'), canonical, sourceRoot, workspace))
      const target = join(root, safeId(workflow.id))
      try { await lstat(target); throw new Error('workflow already exists; edit or select another writable root') }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error }
      const value = draft(workflow)
      return this.install(value.id, value.document, value.files, root, true)
    })
  }

  /** @param id - Override to remove. @param root - Writable root. @param revision - Saved revision. */
  remove(id: string, root: string, revision: string): Promise<void> {
    return this.serialize(async () => {
      const value = await this.read(id, [root])
      const canonical = await realpath(root)
      if (value.sourceDirectory !== join(canonical, safeId(id))) throw new Error('there is no writable override to remove')
      if (value.revision !== revision) throw new Error('workflow changed; reload before removing it')
      await rm(value.sourceDirectory, { recursive: true })
    })
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.writing.then(work)
    this.writing = result.then(() => {}, () => {})
    return result
  }

  private async install(id: string, document: string, files: Readonly<Record<string, string>>, root: string, newOnly = false): Promise<WorkflowDraft> {
    if (Buffer.byteLength(document) > 65536 || Object.keys(files).length > 100 || Object.values(files).reduce((bytes, file) => bytes + Buffer.byteLength(file), 0) > 1024 * 1024) throw new Error('workflow copy exceeds its resource limit')
    await mkdir(root, { recursive: true })
    const canonical = await realpath(root)
    if (canonical === await realpath(this.packageRoot)) throw new Error('packaged workflows are read-only')
    const target = join(canonical, safeId(id))
    const temporaryRoot = join(canonical, `.draft-${randomUUID()}`)
    const temporary = join(temporaryRoot, id)
    await mkdir(temporary, { recursive: true })

    try {
      await writeFile(join(temporary, 'workflow.yml'), document, { flag: 'wx', mode: 0o600 })
      for (const [name, content] of Object.entries(files)) {
        const path = child(temporary, name)
        await mkdir(dirname(path), { recursive: true }); await writeFile(path, content, { flag: 'wx', mode: 0o600 })
      }
      const workflow = await loadWorkflow(id, [temporaryRoot])
      try {
        const stat = await lstat(target)
        if (newOnly) throw new Error('workflow id already exists')
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('workflow override must be a real directory')
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
        await mkdir(target)
      }
      const revisions = join(target, '.revisions')
      await mkdir(revisions, { recursive: true })
      if (await realpath(revisions) !== revisions) throw new Error('workflow revisions directory must not be a symbolic link')
      const revisionDirectory = join(revisions, randomUUID())
      await mkdir(revisionDirectory)
      const relativeRevision = relative(target, revisionDirectory)
      for (const agent of workflow.agents) await writeFile(join(revisionDirectory, `${agent.id}.md`), agent.instructions, { flag: 'wx', mode: 0o600 })
      const { sourceDirectory: _source, ...definition } = workflow
      const canonicalDocument = stringify({ ...definition, agents: workflow.agents.map(agent => ({ ...agent, instructions: `${relativeRevision}/${agent.id}.md` })) })
      const pending = join(target, `.workflow-${randomUUID()}.tmp`)
      await writeFile(pending, canonicalDocument, { flag: 'wx', mode: 0o600 })
      try { await rename(pending, join(target, 'workflow.yml')) } finally { await rm(pending, { force: true }) }
      return draft(await loadWorkflow(id, [canonical]))
    } finally { await rm(temporaryRoot, { recursive: true, force: true }) }
  }
}
