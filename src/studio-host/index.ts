import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'
import { RunJournal } from '../persistence/journal.ts'
import { foldJournal } from '../persistence/fold.ts'
import { validateWorkflowSchema } from '../workflow/loader.ts'

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const remoteInitializers: Array<(this: object) => void> = []

export interface Config {
  readonly journalRoot: string
  readonly workflowDirs?: string[]
  readonly editable?: boolean
}

async function workflowDirectory(id: string, roots: readonly string[]): Promise<string> {
  if (!ID.test(id)) throw new Error('workflow id must be kebab-case')
  for (const root of roots) {
    const directory = join(resolve(root), id)
    try {
      await readFile(join(directory, 'workflow.yml'), 'utf8')
      return directory
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  throw new Error(`workflow "${id}" was not found`)
}

async function workflowIds(roots: readonly string[]): Promise<string[]> {
  const ids = new Set<string>()
  for (const root of roots) {
    try {
      for (const entry of await readdir(resolve(root), { withFileTypes: true })) {
        if (entry.isDirectory() && ID.test(entry.name) && entry.name !== 'shared') ids.add(entry.name)
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return [...ids].sort()
}

async function runRows(root: string): Promise<object[]> {
  const rows: object[] = []
  let entries
  try { entries = await readdir(resolve(root), { withFileTypes: true }) } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return rows
    throw error
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const events = await (await RunJournal.open(root, entry.name)).load()
      const folded = foldJournal(events)
      const childSessionIds = events.flatMap(event => event.type === 'step-end' && event.data.childSessionId !== undefined ? [event.data.childSessionId] : [])
      rows.push({
        runId: folded.runId,
        workflowId: folded.workflowId,
        status: folded.status,
        updatedAt: events.at(-1)?.time ?? 0,
        baseCwd: folded.baseCwd,
        workspace: folded.workspace,
        branch: folded.branch,
        ...(folded.currentStep === undefined ? {} : { currentStep: folded.currentStep }),
        ...(folded.blockedReason === undefined ? {} : { blockedReason: folded.blockedReason }),
        attempts: folded.attempts,
        stories: folded.stories.map(story => ({ id: story.id, title: story.title, status: story.status, retryCount: story.retryCount, ...(story.feedback === undefined ? {} : { feedback: story.feedback }) })),
        childSessionIds: childSessionIds.slice(-50),
      })
    } catch {
      rows.push({ runId: entry.name, workflowId: '', status: 'corrupt', updatedAt: 0 })
    }
  }
  return rows.sort((a, b) => Number((b as { updatedAt: number }).updatedAt) - Number((a as { updatedAt: number }).updatedAt)).slice(0, 100)
}

async function agentFiles(directory: string, yaml: string): Promise<object[]> {
  const parsed = parse(yaml) as { agents?: Array<{ id?: unknown; extends?: unknown }> }
  if (!Array.isArray(parsed.agents)) return []
  const rows: object[] = []
  for (const agent of parsed.agents) {
    if (typeof agent.id !== 'string' || !ID.test(agent.id)) continue
    const inherited = typeof agent.extends === 'string' && /^shared\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agent.extends) ? agent.extends : undefined
    const files: Record<string, string> = {}
    const paths: Record<string, string> = {}
    for (const name of ['IDENTITY.md', 'SOUL.md', 'AGENTS.md']) {
      const localPath = `agents/${agent.id}/${name}`
      const inheritedPath = inherited === undefined ? undefined : `${inherited}/${name}`
      try {
        files[name] = await readFile(join(directory, localPath), 'utf8')
        paths[name] = localPath
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        if (inheritedPath !== undefined) {
          files[name] = await readFile(join(dirname(directory), inheritedPath), 'utf8')
          paths[name] = inheritedPath
        }
      }
    }
    rows.push({ id: agent.id, files, paths })
  }
  return rows
}

async function atomicWrite(path: string, content: string): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.antfarm.tmp`)
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, path)
}

/** Trusted-host Remote projection and canonical workflow editor for Antfarm Studio. */
export class AntfarmStudioGateway extends TypertRemoteService {
  private readonly roots: readonly string[]

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'antfarmStudio')
    for (const initialize of remoteInitializers) initialize.call(this)
    this.roots = [...(config.workflowDirs ?? []), resolve(PACKAGE_ROOT, 'workflows')]
  }

  async index(): Promise<object> {
    return { runs: await runRows(this.config.journalRoot), workflows: await workflowIds(this.roots), editable: this.config.editable === true }
  }

  async workflow(workflowId: string): Promise<object> {
    const directory = await workflowDirectory(workflowId, this.roots)
    const yaml = await readFile(join(directory, 'workflow.yml'), 'utf8')
    const agents = await agentFiles(directory, yaml)
    const revision = createHash('sha256').update(yaml).update(JSON.stringify(agents)).digest('hex').slice(0, 16)
    return { id: workflowId, directory, yaml, agents, revision }
  }

  async save(workflowId: string, path: string, content: string): Promise<object> {
    if (this.config.editable !== true) throw new Error('Antfarm Studio editing is disabled')
    const directory = await workflowDirectory(workflowId, this.roots)
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) throw new Error('content exceeds the 1 MiB limit')
    const local = /^agents\/[a-z0-9]+(?:-[a-z0-9]+)*\/(IDENTITY|SOUL|AGENTS)\.md$/.test(path)
    const shared = /^shared\/[a-z0-9]+(?:-[a-z0-9]+)*\/(IDENTITY|SOUL|AGENTS)\.md$/.test(path)
    if (path !== 'workflow.yml' && !local && !shared) throw new Error('path is not an editable workflow file')
    if (path === 'workflow.yml') validateWorkflowSchema(workflowId, content)
    const target = shared ? join(dirname(directory), path) : join(directory, path)
    await atomicWrite(target, content)
    return { saved: true }
  }
}

function markRemote(name: 'index' | 'workflow' | 'save'): void {
  const method = AntfarmStudioGateway.prototype[name] as (this: AntfarmStudioGateway, ...args: unknown[]) => unknown
  Remote(name)(method, {
    kind: 'method',
    name,
    static: false,
    private: false,
    access: { has: object => name in object, get: object => (object as AntfarmStudioGateway)[name] as typeof method },
    addInitializer: initializer => { remoteInitializers.push(initializer as (this: object) => void) },
    metadata: undefined,
  })
}

markRemote('index')
markRemote('workflow')
markRemote('save')

export default AntfarmStudioGateway
