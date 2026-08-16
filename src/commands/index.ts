import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type {} from '../runtime/index.ts'

export const name = 'antfarm-commands'
export const inject = ['antfarm', 'commands']

const USAGE = 'Usage: /antfarm <task...> | run [--workflow <id>] <task...> | fix <task...> | audit <task...> | smoke <task...> | list | status <runId> | cancel <runId> [reason...] | resume <runId> [guidance...] | cleanup <runId>'
const SHORTCUTS: Readonly<Record<string, string>> = {
  fix: 'bug-fix',
  audit: 'security-audit',
  smoke: 'smoke',
}

export type ParsedAntfarmCommand =
  | { readonly action: 'start', readonly task: string, readonly workflowId?: string }
  | { readonly action: 'list' }
  | { readonly action: 'status' | 'cleanup', readonly runId: string }
  | { readonly action: 'cancel', readonly runId: string, readonly reason: string }
  | { readonly action: 'resume', readonly runId: string, readonly guidance?: string }

function words(input: string): string[] {
  return input.trim().split(/\s+/u).filter(Boolean)
}

/** Parse one human command without applying runtime defaults or side effects. */
export function parseAntfarmCommand(input: string): ParsedAntfarmCommand | undefined {
  const tokens = words(input)
  const [first, second, ...rest] = tokens
  if (first === undefined) return undefined
  if (first === 'list') return tokens.length === 1 ? { action: 'list' } : undefined
  if (first === 'status' || first === 'cleanup') {
    return second !== undefined && rest.length === 0 ? { action: first, runId: second } : undefined
  }
  if (first === 'cancel') {
    return second === undefined ? undefined : { action: 'cancel', runId: second, reason: rest.join(' ') || 'cancelled by user' }
  }
  if (first === 'resume') {
    if (second === undefined) return undefined
    const guidance = rest.join(' ')
    return { action: 'resume', runId: second, ...(guidance === '' ? {} : { guidance }) }
  }
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
      const runs = await ctx.antfarm.list(invocation.agent)
      return { kind: 'success', text: runs.length === 0 ? 'No active or resumable antfarm runs.' : runs.map(run => `${run.runId} [${run.status}] ${run.workflowId}${run.currentStep === undefined ? '' : ` step=${run.currentStep}`}\n  ${run.workspace}`).join('\n') }
    }
    case 'status': {
      const status = await ctx.antfarm.status(command.runId, invocation.agent)
      const stories = status.stories.map(story => `- ${story.id} [${story.status}] retries=${story.retryCount}${story.feedback === undefined ? '' : `: ${story.feedback}`}`)
      return { kind: 'success', text: `${command.runId} [${status.summary.status}] ${status.summary.workflowId}\nWorkspace: ${status.summary.workspace}${status.summary.currentStep === undefined ? '' : `\nCurrent step: ${status.summary.currentStep}`}${stories.length === 0 ? '' : `\nStories:\n${stories.join('\n')}`}` }
    }
    case 'cancel': {
      const summary = await ctx.antfarm.cancel(command.runId, invocation.agent, command.reason)
      return { kind: 'success', text: `Cancellation requested for ${command.runId}. Current status: ${summary.status}.` }
    }
    case 'resume': {
      const receipt = await ctx.antfarm.resume({ runId: command.runId, parent: invocation.agent, ...(command.guidance === undefined ? {} : { guidance: command.guidance }), signal: invocation.signal })
      return { kind: 'success', text: `Antfarm run ${command.runId} resumed as job ${receipt.jobId}.` }
    }
    case 'cleanup': {
      const summary = await ctx.antfarm.cleanup(command.runId, invocation.agent)
      return { kind: 'success', text: `Clean-only cleanup checked ${command.runId}. Workspace: ${summary.workspace}` }
    }
  }
}

/** Register the human-facing antfarm command. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'antfarm',
    description: 'run and control antfarm team workflows',
    input: { hint: '<task> | run|fix|audit|smoke|list|status|cancel|resume|cleanup ...' },
    handler: invocation => executeAntfarm(ctx, invocation),
  })
}
