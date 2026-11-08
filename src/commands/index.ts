import type { Context } from '@deepseek-ai/cordis'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type {} from '../runtime/index.ts'

export const name = 'antfarm-commands'
export const inject = ['antfarm', 'commands']

const USAGE = 'Usage: /antfarm <task...> | run [--workflow <id>] <task...> | fix <task...> | audit <task...> | list | status <runId> | stories <runId> | logs [runId] | cancel <runId> [reason...] | resume <runId> [guidance...] | workflows | import <directory> <sourceRoot> | install|uninstall <id|all> [--force] | health | ensure-execution | help | version | ant'
const SHORTCUTS: Readonly<Record<string, string>> = {
  fix: 'bug-fix',
  audit: 'security-audit',
}

/** Parsed human operation before runtime admission. */
export type ParsedAntfarmCommand =
  | { readonly action: 'start', readonly task: string, readonly workflowId?: string }
  | { readonly action: 'list' | 'workflows' | 'help' | 'version' | 'ant' | 'health' | 'ensure-execution' }
  | { readonly action: 'install' | 'uninstall', readonly id: string, readonly force: boolean }
  | { readonly action: 'import', readonly directory: string, readonly sourceRoot: string }
  | { readonly action: 'status', readonly runId: string }
  | { readonly action: 'stories', readonly runId: string }
  | { readonly action: 'logs', readonly runId?: string }
  | { readonly action: 'cancel', readonly runId: string, readonly reason: string }
  | { readonly action: 'resume', readonly runId: string, readonly guidance?: string }

function words(input: string): string[] {
  return input.trim().split(/\s+/u).filter(Boolean)
}

/**
 * Parse one human command without applying runtime defaults or side effects.
 * @param input - Command text after /antfarm.
 * @returns Requested operation, or undefined for invalid input.
 */
export function parseAntfarmCommand(input: string): ParsedAntfarmCommand | undefined {
  const tokens = words(input)
  const [first, second, ...rest] = tokens
  if (first === undefined) return undefined
  if (['workflows', 'help', 'version', 'ant', 'health', 'ensure-execution'].includes(first)) return tokens.length === 1 ? { action: first as 'workflows' | 'help' | 'version' | 'ant' | 'health' | 'ensure-execution' } : undefined
  if (first === 'install' || first === 'uninstall') return second !== undefined && (rest.length === 0 || (rest.length === 1 && rest[0] === '--force')) ? { action: first, id: second, force: rest[0] === '--force' } : undefined
  if (first === 'import') return second !== undefined && rest.length === 1 ? { action: 'import', directory: second, sourceRoot: rest[0]! } : undefined
  if (first === 'list') return tokens.length === 1 ? { action: 'list' } : undefined
  if (first === 'logs') return { action: 'logs', ...(second === undefined ? {} : { runId: [second, ...rest].join(' ') }) }
  if (first === 'status' || first === 'stories') {
    return second !== undefined ? { action: first, runId: [second, ...rest].join(' ') } : undefined
  }
  if (first === 'cancel') {
    return second === undefined ? undefined : { action: 'cancel', runId: second, reason: rest.join(' ') || 'cancelled by user' }
  }
  if (first === 'resume') {
    if (second === undefined) return undefined
    if (rest.includes('--retry-grant')) return undefined
    const guidance = rest.join(' ')
    return { action: 'resume', runId: second, ...(guidance === '' ? {} : { guidance }) }
  }
  if (first === 'cleanup' || first === 'smoke') return undefined
  if (first === 'run') {
    if (second === '--workflow') {
      const [workflowId, ...task] = rest
      return workflowId === undefined || task.length === 0 ? undefined : { action: 'start', workflowId, task: task.join(' ') }
    }
    const task = tokens.slice(1).join(' ')
    return task === '' ? undefined : { action: 'start', task }
  }
  const workflowId = SHORTCUTS[first]
  if (workflowId !== undefined) {
    const task = tokens.slice(1).join(' ')
    return task === '' ? undefined : { action: 'start', workflowId, task }
  }
  return { action: 'start', task: tokens.join(' ') }
}

async function executeAntfarm(ctx: Context, invocation: CommandInvocation): Promise<CommandResult> {
  const command = parseAntfarmCommand(invocation.rawInput)
  if (command === undefined) return { kind: 'error', text: USAGE }
  switch (command.action) {
    case 'help': return { kind: 'success', text: USAGE }
    case 'version': return { kind: 'success', text: 'dsh-antfarm 0.3.0; original Antfarm YAML and SQLite' }
    case 'ant': return { kind: 'success', text: 'Antfarm: install a specialist team, run bounded work, and verify its delivery.' }
    case 'health': return { kind: 'success', text: JSON.stringify(await ctx.antfarm.checkHealth(invocation.agent.id), null, 2) }
    case 'ensure-execution': return { kind: 'success', text: `Dispatched: ${(await ctx.antfarm.ensureExecution(invocation.agent.id)).join(', ') || 'no safely resumable work'}` }
    case 'install':
    case 'uninstall': await ctx.antfarm.setWorkflowEnabled(invocation.agent, command.id, command.action === 'install', command.force); return { kind: 'success', text: `${command.id}: ${command.action === 'install' ? 'installed' : 'uninstalled'}` }
    case 'workflows': return { kind: 'success', text: (await ctx.antfarm.listWorkflows(invocation.agent)).join('\n') }
    case 'import': { const value = await ctx.antfarm.importWorkflow(invocation.agent, command.directory, command.sourceRoot); return { kind: 'success', text: `Imported ${value.id} into ${value.sourceDirectory}` } }
    case 'stories': {
      const status = await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id)
      return { kind: 'success', text: JSON.stringify(status.stories, null, 2) }
    }
    case 'logs': {
      const runs = command.runId === undefined ? await ctx.antfarm.list(invocation.agent.id) : [(await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id)).summary]
      const pages = await Promise.all(runs.filter(run => run.status !== 'legacy' && run.status !== 'corrupt').map(async run => {
        const events = await ctx.antfarm.events(run.runId, invocation.agent.id, Math.max(-1, (run.revision ?? 49) - 50))
        return events.map(event => ({ runId: run.runId, ...event }))
      }))
      return { kind: 'success', text: JSON.stringify(pages.flat().sort((a, b) => a.time - b.time).slice(-50), null, 2) }
    }
    case 'start': {
      const receipt = await ctx.antfarm.start({
        task: command.task,
        parent: invocation.agent,
        ...(command.workflowId === undefined ? {} : { workflowId: command.workflowId }),
        signal: invocation.signal,
      })
      return { kind: 'success', text: `Antfarm run ${receipt.runId} started as job ${receipt.jobId}.\nWorkflow: ${receipt.workflowId}\nWorkspace: ${receipt.workspace}\nBranch: ${receipt.branch}` }
    }
    case 'list': {
      const runs = await ctx.antfarm.list(invocation.agent.id)
      return { kind: 'success', text: runs.length === 0 ? 'No Antfarm runs in this session.' : runs.map(run => `#${run.number ?? '?'} ${run.runId} [${run.status}] ${run.workflowId}${run.currentStep === undefined ? '' : ` step=${run.currentStep}`}\n  ${run.task ?? ''}\n  ${run.workspace}`).join('\n') }
    }
    case 'status': {
      const status = await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id)
      const stories = status.stories.map(story => `- ${story.id} [${story.status}] retries=${story.retryCount}${story.feedback === undefined ? '' : `: ${story.feedback}`}`)
      return { kind: 'success', text: `${command.runId} [${status.summary.status}] ${status.summary.workflowId}\nWorkspace: ${status.summary.workspace}${status.summary.currentStep === undefined ? '' : `\nCurrent step: ${status.summary.currentStep}`}${stories.length === 0 ? '' : `\nStories:\n${stories.join('\n')}`}` }
    }
    case 'cancel': {
      const summary = await ctx.antfarm.cancel(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id, command.reason)
      return { kind: 'success', text: `Cancellation requested for ${command.runId}. Current status: ${summary.status}.` }
    }
    case 'resume': {
      const receipt = await ctx.antfarm.resume({ runId: await ctx.antfarm.find(command.runId, invocation.agent.id), parent: invocation.agent, ...(command.guidance === undefined ? {} : { guidance: command.guidance }), signal: invocation.signal })
      return { kind: 'success', text: `Antfarm run ${command.runId} resumed as job ${receipt.jobId}.` }
    }

  }
}

/** Register the human-facing antfarm command. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.commands.register({
    definitionId: CommandDefinitionId('dsh-antfarm/antfarm'),
    name: 'antfarm',
    description: 'run and control antfarm team workflows',
    input: { hint: '<task> | run|fix|audit|list|status|cancel|resume ...' },
    handler: invocation => executeAntfarm(ctx, invocation),
  }))
}
