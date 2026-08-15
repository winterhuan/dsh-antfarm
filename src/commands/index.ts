import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import type {} from '../runtime/index.ts'

export const name = 'antfarm-commands'
export const inject = ['antfarm', 'commands']

const USAGE = 'Usage: /antfarm run <workflow> <task...> | list | status <runId> | cancel <runId> [reason...] | resume <runId> [guidance...] | cleanup <runId>'

function words(input: string): string[] {
  return input.trim().split(/\s+/u).filter(Boolean)
}

async function executeAntfarm(ctx: Context, invocation: CommandInvocation): Promise<CommandResult> {
  const [action, runId, ...rest] = words(invocation.rawInput)
  if (action === undefined) return { kind: 'error', text: USAGE }
  switch (action) {
    case 'run': {
      if (runId === undefined || rest.length === 0) return { kind: 'error', text: USAGE }
      const receipt = await ctx.antfarm.start({ workflowId: runId, task: rest.join(' '), parent: invocation.agent, signal: invocation.signal })
      return { kind: 'success', text: `Antfarm run ${receipt.runId} started as job ${receipt.jobId}.\nWorkspace: ${receipt.workspace}\nBranch: ${receipt.branch}` }
    }
    case 'list': {
      if (runId !== undefined) return { kind: 'error', text: USAGE }
      const runs = await ctx.antfarm.list(invocation.agent)
      return { kind: 'success', text: runs.length === 0 ? 'No active or resumable antfarm runs.' : runs.map(run => `${run.runId} [${run.status}] ${run.workflowId}${run.currentStep === undefined ? '' : ` step=${run.currentStep}`}\n  ${run.workspace}`).join('\n') }
    }
    case 'status': {
      if (runId === undefined || rest.length > 0) return { kind: 'error', text: USAGE }
      const status = await ctx.antfarm.status(runId, invocation.agent)
      const stories = status.stories.map(story => `- ${story.id} [${story.status}] retries=${story.retryCount}${story.feedback === undefined ? '' : `: ${story.feedback}`}`)
      return { kind: 'success', text: `${runId} [${status.summary.status}] ${status.summary.workflowId}\nWorkspace: ${status.summary.workspace}${status.summary.currentStep === undefined ? '' : `\nCurrent step: ${status.summary.currentStep}`}${stories.length === 0 ? '' : `\nStories:\n${stories.join('\n')}`}` }
    }
    case 'cancel': {
      if (runId === undefined) return { kind: 'error', text: USAGE }
      const summary = await ctx.antfarm.cancel(runId, invocation.agent, rest.join(' ') || 'cancelled by user')
      return { kind: 'success', text: `Cancellation requested for ${runId}. Current status: ${summary.status}.` }
    }
    case 'resume': {
      if (runId === undefined) return { kind: 'error', text: USAGE }
      const guidance = rest.join(' ')
      const receipt = await ctx.antfarm.resume({ runId, parent: invocation.agent, ...(guidance === '' ? {} : { guidance }), signal: invocation.signal })
      return { kind: 'success', text: `Antfarm run ${runId} resumed as job ${receipt.jobId}.` }
    }
    case 'cleanup': {
      if (runId === undefined || rest.length > 0) return { kind: 'error', text: USAGE }
      const summary = await ctx.antfarm.cleanup(runId, invocation.agent)
      return { kind: 'success', text: `Clean-only cleanup checked ${runId}. Workspace: ${summary.workspace}` }
    }
    default:
      return { kind: 'error', text: USAGE }
  }
}

/** Register the human-facing antfarm command. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'antfarm',
    description: 'run and control antfarm team workflows',
    input: { hint: 'run|list|status|cancel|resume|cleanup ...' },
    handler: invocation => executeAntfarm(ctx, invocation),
  })
}
