/** Stable Antfarm identities rendered into fresh native child Sessions. */
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-skill'
import type { ResolvedAgent, ResolvedWorkflow } from '../workflow/types.ts'
import { resolveTemplate, type ClaimedStep } from '../persistence/database.ts'

const writes = new Set(['write', 'edit', 'apply_patch'])
const delegation = new Set([
  'subagent',
  'subagent_fork',
  'workflow',
  'spawn_teammate',
  'send_message',
  'interrupt_agent',
  'list_agents',
  'wait_agent',
  'antfarm_run',
  'antfarm_resume',
])
/** A role deadline expires without an original completion response. */
export class AttemptTimeoutError extends Error {}
/** Child teardown cannot confirm that effects have stopped. */
export class AttemptTeardownError extends Error {}
/** @param role - Original role. @param tool - DSH tool name. @returns Whether the role may invoke the tool. */
export function roleAllows(role: ResolvedAgent['role'], tool: string): boolean {
  if (delegation.has(tool) || tool.startsWith('team_task_')) return false
  if (tool.startsWith('schedule_') || tool === 'plugin_manager') return false
  if (role !== 'coding' && writes.has(tool)) return false
  if (['web_search', 'web_fetch'].includes(tool)) return role === 'testing' || role === 'scanning'
  if (tool.includes('browser') || tool.startsWith('computer_')) return role === 'testing'
  return !['image', 'tts', 'gateway', 'cron', 'message', 'nodes', 'canvas'].includes(tool)
}
/** DSH transport; persona is selected by attempt identity, never by a role preset. */
export class AntfarmAgents {
  private readonly active = new Map<string, { agent: ResolvedAgent; persona: string }>()
  /** @param ctx - Native host. @param root - Private installed agent workspaces. */
  constructor(
    private readonly ctx: Context,
    private readonly root: string,
  ) {
    ctx.effect(() =>
      ctx.systemPrompt.section({
        name: 'antfarm-identity',
        order: 640,
        interpolate: false,
        text: (context) => this.active.get(context.agent?.id ?? '')?.persona ?? '',
      }),
    )
    ctx.effect(() =>
      ctx.tools.guard((exec) => {
        const identity = this.active.get(exec.agent?.id ?? '')
        return identity && !roleAllows(identity.agent.role, exec.name)
          ? `Antfarm ${identity.agent.role} role cannot invoke ${exec.name}.`
          : undefined
      }),
    )
    ctx.on('agent/created', ({ agent }) => {
      const identity = this.active.get(agent.id)
      if (!identity) return
      for (const tool of ctx.tools.schemas(agent))
        if (!roleAllows(identity.agent.role, tool.name)) {
          try {
            agent.ctx.tools.restrict({ deny: [tool.name] })
          } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('unknown global tool')) throw error
          }
        }
    })
  }
  /** @param workflow - Installed method. @param agent - Stable role identity. @param provision - Update owned resources only under a claimed agent. @returns Canonical workspace path. */
  async workspace(workflow: ResolvedWorkflow, agent: ResolvedAgent, provision: boolean = true): Promise<string> {
    await mkdir(this.root, { recursive: true })
    const root = await realpath(this.root),
      target = resolve(root, workflow.id, agent.workspace.baseDir)
    const rel = relative(root, target)
    if (isAbsolute(rel) || rel.startsWith(`..${sep}`)) throw new Error('agent workspace escaped its root')
    let path = root
    for (const part of rel.split(sep)) {
      path = join(path, part)
      await mkdir(path, { recursive: true })
      if ((await realpath(path)) !== path) throw new Error('agent workspace must not use symbolic links')
    }
    if (!provision) return target
    const manifestPath = join(target, '.antfarm-persona.json')
    let previous: Record<string, string> = {}
    try {
      if ((await realpath(manifestPath)) !== manifestPath)
        throw new Error('agent resource manifest must not be a symbolic link')
      previous = z.record(z.string(), z.string()).parse(JSON.parse(await readFile(manifestPath, 'utf8')))
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
    const digests: Record<string, string> = {}
    for (const [name, content] of Object.entries(agent.files)) {
      const file = resolve(target, name)
      if (!file.startsWith(target + sep)) throw new Error('agent resource escaped workspace')
      await mkdir(dirname(file), { recursive: true })
      if ((await realpath(dirname(file))) !== dirname(file))
        throw new Error('agent resource directory must not use symbolic links')
      try {
        await writeFile(file, content, { flag: 'wx', mode: 0o600 })
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
        if ((await realpath(file)) !== file) throw new Error('agent resource must not be a symbolic link')
        const current = await readFile(file, 'utf8')
        if (current !== content) {
          if (previous[name] !== createHash('sha256').update(current).digest('hex'))
            throw new Error(
              `Agent resource ${name} has local edits; save them in the workflow definition before starting`,
            )
          await writeFile(file, content, { mode: 0o600 })
        }
      }
      digests[name] = createHash('sha256').update(content).digest('hex')
    }
    await writeFile(manifestPath, JSON.stringify(digests), { mode: 0o600 })
    return target
  }
  /** @param workflow - Run method. @param claim - Persisted claimant. @param parent - Native owner. @param cwd - Agent workspace. @param project - Owner project. @param provider - Native spawn provider. @param signal - Attempt cancellation. @returns Original text output. */
  async execute(
    workflow: ResolvedWorkflow,
    claim: ClaimedStep,
    parent: Agent,
    cwd: string,
    project: string,
    provider: string,
    signal: AbortSignal,
  ): Promise<string> {
    const agent = workflow.agents.find((agent) => `${workflow.id}_${agent.id}` === claim.step.agent_id)
    if (!agent) throw new Error('claimed agent is not in workflow')
    const sections = await Promise.all(
      Object.keys(agent.files).map(async (name) => `## ${name}\n${await readFile(join(cwd, name), 'utf8')}`),
    )
    for (const name of agent.workspace.skills ?? []) {
      const skill = await this.ctx.get('skills')?.get(name, { cwd: project, scope: parent, signal })
      if (!skill) {
        sections.push(`## Optional skill: ${name}\nThis skill is unavailable in the owning DSH profile. Use available tools; report any capability needed to finish the task.`)
        continue
      }
      sections.push(`## Skill: ${name}\n${skill.path ? `Instruction path: ${skill.path}\n` : ''}${skill.content}`)
    }
    const persona = resolveTemplate(`# Antfarm identity: ${workflow.id}/${agent.id}\n${sections.join('\n\n')}`, {
      run_id: claim.step.run_id,
    })
    this.active.set(claim.sessionId, { agent, persona })
    const model = agent.model ?? workflow.polling?.model
    const controller = new AbortController(),
      timer = setTimeout(
        () => controller.abort(new AttemptTimeoutError('Antfarm step timed out')),
        agent.timeoutSeconds * 1000,
      )
    const attemptSignal = AbortSignal.any([signal, controller.signal])
    try {
      const activation = await this.ctx.subagents.startActivation({
        provider,
        label: agent.name,
        childId: SessionId(claim.sessionId),
        delivery: 'caller',
        signal: attemptSignal,
        request: {
          parent,
          cwd,
          agentPreset: 'standard',
          prompt: [
            {
              type: 'text',
              text: `Project directory: ${project}\n\n${claim.input}\n\nReturn the requested KEY: value output in your final reply. The host records completion; do not call the OpenClaw antfarm CLI.`,
            },
          ],
          ...(model === undefined || model === 'default' ? {} : { agentOptions: { model } }),
        },
      })
      let disposal: Promise<void> | undefined
      const dispose = () => (disposal ??= activation.dispose())
      let abort: (() => void) | undefined
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          abort = () => {
            void dispose().catch(reject)
            reject(attemptSignal.reason)
          }
          attemptSignal.addEventListener('abort', abort, { once: true })
          if (attemptSignal.aborted) abort()
        })
        const result = await Promise.race([activation.result, cancelled])
        attemptSignal.throwIfAborted()
        if (result.stopReason !== 'completed')
          throw new Error(result.diagnostic ?? `Agent stopped: ${result.stopReason}`)
        return result.output
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
      } finally {
        if (abort) attemptSignal.removeEventListener('abort', abort)
        try {
          await dispose()
        } catch (error) {
          throw new AttemptTeardownError('Native child teardown failed; inspect the attempt before resuming', {
            cause: error,
          })
        }
      }
    } finally {
      clearTimeout(timer)
      this.active.delete(claim.sessionId)
    }
  }
}
