import { Context, Service } from '@deepseek-ai/cordis'
import Loader, { Group } from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import SubagentRuntime, { type SubagentProvider } from '@deepseek-ai/dsh-subagent'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'

class SmokeJobs extends Service {
  constructor(ctx: Context) {
    super(ctx, 'jobs')
  }
}

class SmokeSubprocess extends Service {
  constructor(ctx: Context) {
    super(ctx, 'subprocess')
  }
}

const mockProvider: SubagentProvider = {
  name: 'mock',
  capabilities: { outputSchema: true, depthLimit: true, toolFilter: true, persona: true },
  inheritsParentContext: false,
  async start() {
    throw new Error('composition smoke must not start a subagent')
  },
}

const MockProvider = {
  inject: ['subagents'],
  apply(ctx: Context) {
    ctx.subagents.registerProvider(mockProvider)
  },
}

const root = new Context()
const hostFibers = await Promise.all([
  root.plugin(AgentRegistry),
  root.plugin(CommandRuntime),
  root.plugin(SmokeJobs),
  root.plugin(SubagentRuntime),
  root.plugin(SmokeSubprocess),
  root.plugin(SystemPrompt),
])
hostFibers.push(await root.plugin(ToolRuntime))
hostFibers.push(await root.plugin(MockProvider))

const loaderFiber = await root.plugin(Loader, { baseUrl: import.meta.url })
root.loader.builtins.group = Group
const rows = [
  ['runtime', import.meta.resolve('dsh-antfarm/runtime'), { journalRoot: process.cwd(), workflowDirs: [], subagentProvider: 'mock' }],
  ['tool', import.meta.resolve('dsh-antfarm/tool')],
  ['commands', import.meta.resolve('dsh-antfarm/commands')],
  ['studio-host', import.meta.resolve('dsh-antfarm/studio-host'), { journalRoot: process.cwd(), workflowDirs: [] }],
] as const

try {
  const groupId = await root.loader.create({
    name: 'cordis:group',
    group: true,
    config: rows.map(([id, name, config]) => ({ id, name, ...(config === undefined ? {} : { config }) })),
  })
  await root.loader.await()

  if (root.get('antfarm') === undefined) throw new Error('runtime row did not provide antfarm')
  if (root.get('antfarmStudio') === undefined) throw new Error('studio-host row did not provide antfarmStudio')
  if (root.subagents.getProvider('mock') !== mockProvider) throw new Error('mock subagent provider is not registered')

  const toolSchemas = root.tools.schemas()
  const toolNames = toolSchemas.map(schema => schema.name)
  for (const name of ['antfarm_run', 'antfarm_list', 'antfarm_status', 'antfarm_resume', 'antfarm_cancel', 'antfarm_cleanup']) {
    if (!toolNames.includes(name)) throw new Error(`tool row did not register ${name}`)
  }
  const runParameters = toolSchemas.find(schema => schema.name === 'antfarm_run')?.parameters as { required?: string[] } | undefined
  if (runParameters?.required?.includes('task') !== true || runParameters.required.includes('workflow_id')) {
    throw new Error('antfarm_run must require task and leave workflow_id optional')
  }
  if (root.commands.find({} as never, 'antfarm') === undefined) throw new Error('commands row did not register antfarm')

  for (const [id] of rows) {
    const entry = root.loader.resolve(id)
    if (entry.fiber?.state !== 2) throw new Error(`${id} row is not active (state ${String(entry.fiber?.state)})`)
  }

  await root.loader.remove(groupId)
  if (root.get('antfarm') !== undefined || root.get('antfarmStudio') !== undefined) {
    throw new Error('composition services survived Loader disposal')
  }
  process.stdout.write('antfarm composition mounted and disposed\n')
} finally {
  await loaderFiber.dispose()
  await Promise.all(hostFibers.reverse().map(fiber => fiber.dispose()))
}
