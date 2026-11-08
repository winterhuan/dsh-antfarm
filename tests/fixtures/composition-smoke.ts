import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import Loader, { Group } from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '../../src/runtime/index.ts'
import type {} from '../../src/studio-host/index.ts'

/** Execution dependencies expose presence only; this fixture never starts a model or workflow. */
class IdleDependency extends Service {
  constructor(ctx: Context, name: string) {
    super(ctx, name)
  }
}

class IdleJobs extends Service {
  private readonly state: { starts: number }
  constructor(ctx: Context, state: { starts: number }) {
    super(ctx, 'jobs')
    this.state = state
  }
  start(): never {
    this.state.starts += 1
    throw new Error('Loader composition fixture must not start a background job')
  }
}

const journalRoot = process.argv[2]
assert.ok(journalRoot, 'composition fixture requires its private journal directory')
const omitJobs = process.argv[3] === '--omit-jobs'
const root = new Context()
const jobsState = { starts: 0 }
const toolNames = ['antfarm_run', 'antfarm_list', 'antfarm_status', 'antfarm_resume', 'antfarm_cancel', 'antfarm_cleanup'].sort()
// Commands need only a scope identity for registry lookup; this token is never driven as an Agent.
const reader = { id: SessionId('composition-reader'), session: Session.create(SessionId('composition-reader')) } as Agent

try {
  for (const name of ['agents', 'sessions', 'workingDirectory', 'agentPresets', 'subagents', 'subprocess']) {
    await root.plugin(IdleDependency, name)
  }
  if (!omitJobs) await root.plugin(IdleJobs, jobsState)
  await root.plugin(CommandRuntime)
  await root.plugin(SystemPrompt, {})
  await root.plugin(ToolRuntime)
  await root.plugin(Loader, { baseUrl: import.meta.url })
  root.loader.builtins.group = Group
  const rows = [
    { id: 'runtime', name: import.meta.resolve('dsh-antfarm/runtime'), config: { journalRoot, workflowDirs: [] } },
    { id: 'tool', name: import.meta.resolve('dsh-antfarm/tool') },
    { id: 'commands', name: import.meta.resolve('dsh-antfarm/commands') },
    { id: 'studio-host', name: import.meta.resolve('dsh-antfarm/studio-host') },
  ]
  const groupId = await root.loader.create({ name: 'cordis:group', group: true, config: rows })
  await root.loader.await()
  const mounted = rows.map(({ id }) => {
    const fiber = root.loader.resolve(id).fiber
    assert.equal(fiber?.state, 2, `${id} row is not active`)
    assert.ok(fiber)
    return fiber
  })

  const schemas = root.tools.schemas()
  assert.deepEqual(schemas.map(schema => schema.name).sort(), toolNames)
  for (const schema of schemas) {
    const parameters = schema.parameters
    assert.ok(parameters && typeof parameters === 'object' && 'type' in parameters)
    assert.equal(parameters.type, 'object')
    const required = 'required' in parameters ? parameters.required : []
    assert.deepEqual(required, schema.name === 'antfarm_run' ? ['task'] : schema.name === 'antfarm_list' ? [] : ['run_id'])
  }
  const childId = SessionId('composition-child')
  const child = { id: childId, session: Session.create(childId, [], { ...reader.session.header, id: childId, origin: 'subagent', parentSession: reader.id }) } as Agent
  for (const agent of [reader, child]) {
    const selection = await root.tools.resolve({ agent, modelSelection: { provider: 'fixture', model: 'fixture' }, signal: new AbortController().signal })
    try {
      assert.deepEqual(root.tools.schemas(agent, selection).map(schema => schema.name).sort(), agent === reader ? toolNames : [])
      for (const name of toolNames) assert.equal(root.tools.executable(name, agent, selection) !== undefined, agent === reader)
    } finally {
      selection.dispose()
    }
  }
  const commands = root.commands.list(reader).map(command => command.name)
  assert.deepEqual(commands, ['antfarm'])
  assert.equal(root.commands.find(reader, 'antfarm')?.definitionId, 'dsh-antfarm/antfarm')

  const studioMethods = remoteMethods(root.antfarmStudio).map(marker => marker.method).sort()
  assert.deepEqual(studioMethods, ['artifact', 'artifactContent', 'board', 'control', 'copyWorkflow', 'ensureExecution', 'events', 'health', 'healthHistory', 'list', 'page', 'removeWorkflow', 'saveWorkflow', 'setWorkflowEnabled', 'start', 'status', 'workflow', 'workflows'])
  const before = await readdir(journalRoot)
  const studioRuns = await root.antfarmStudio.list(reader.id, new AbortController().signal)
  assert.deepEqual(studioRuns, [])
  await assert.rejects(root.antfarmStudio.status('af-missing', reader.id, new AbortController().signal))
  assert.deepEqual(await readdir(journalRoot), before)
  assert.equal(jobsState.starts, 0)

  root.loader.remove(groupId)
  await Promise.all(mounted.map(fiber => fiber.dispose()))
  const disposed = {
    tools: root.tools.schemas().map(schema => schema.name),
    commands: root.commands.list(reader).map(command => command.name),
    runtime: root.get('antfarm') !== undefined,
    studio: root.get('antfarmStudio') !== undefined,
  }
  assert.deepEqual(disposed, { tools: [], commands: [], runtime: false, studio: false })
  process.stdout.write(JSON.stringify({ toolNames, commands, studioMethods, studioRuns, disposed }) + '\n')
} finally {
  await root.fiber.dispose()
}
