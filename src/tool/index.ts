import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '../runtime/index.ts'

export const name = 'antfarm-tools'
export const inject = ['agents', 'antfarm', 'tools']

const summaryOutput = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    run_id: { type: 'string' as const, required: true },
    status: { type: 'string' as const, required: true },
    workspace: { type: 'string' as const, required: true },
    branch: { type: 'string' as const, required: true },
  },
} as const

const runOutput = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    run_id: { type: 'string' as const, required: true },
    job_id: { type: 'string' as const, required: true },
    workflow_id: { type: 'string' as const, required: true },
    status: { type: 'string' as const, required: true },
    workspace: { type: 'string' as const, required: true },
    branch: { type: 'string' as const, required: true },
  },
} as const

/** Register model-facing antfarm run and list tools. */
export function apply(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: 'antfarm_run',
    description: 'Start a declared antfarm team workflow in the background. Use this only when the user explicitly requests an antfarm or multi-agent team workflow; use ordinary subagent delegation for a single focused task.',
    parameters: {
      task: { type: 'string', required: true, description: 'Complete task for the workflow team.' },
      workflow_id: { type: 'string', description: 'Optional workflow id. Omit it to use the configured default, normally feature-dev.' },
      cwd: { type: 'string', description: 'Git working directory. Defaults to the caller session workspace.' },
      provider: { type: 'string', description: 'Registered subagent provider. Defaults to the plugin configuration.' },
      model: { type: 'string', description: 'Optional model override for workflow agents.' },
      isolation: { type: 'string', enum: ['worktree', 'shared'], description: 'Workspace isolation. Defaults to worktree.' },
    },
    output: {
      schema: runOutput,
      render(_args, value): ContentBlock[] {
        return [{ type: 'text', text: `Antfarm run ${value.run_id} started as job ${value.job_id}.\nWorkflow: ${value.workflow_id}\nWorkspace: ${value.workspace}\nBranch: ${value.branch}\nUse antfarm_list or the jobs tools to inspect progress.` }]
      },
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('antfarm_run requires an initiating agent')
      const receipt = await ctx.antfarm.start({
        task: args.task,
        ...(args.workflow_id === undefined ? {} : { workflowId: args.workflow_id }),
        parent,
        ...(args.cwd === undefined ? {} : { cwd: args.cwd }),
        ...(args.provider === undefined ? {} : { provider: args.provider }),
        ...(args.model === undefined ? {} : { model: args.model }),
        ...(args.isolation === undefined ? {} : { isolation: args.isolation }),
        signal: exec.signal,
      })
      return { run_id: receipt.runId, job_id: String(receipt.jobId), workflow_id: receipt.workflowId, status: receipt.status, workspace: receipt.workspace, branch: receipt.branch }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'antfarm_list',
    description: 'List this session\'s antfarm runs with bounded status summaries.',
    parameters: {},
    output: {
      schema: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            run_id: { type: 'string', required: true },
            job_id: { type: 'string' },
            workflow_id: { type: 'string', required: true },
            status: { type: 'string', required: true },
            workspace: { type: 'string', required: true },
            branch: { type: 'string', required: true },
            current_step: { type: 'string' },
          },
        },
      },
      render(_args, value): ContentBlock[] {
        if (value.length === 0) return [{ type: 'text', text: 'No antfarm runs are visible to this session.' }]
        return [{ type: 'text', text: value.map(run => `${run.run_id} [${run.status}] ${run.workflow_id}${run.current_step === undefined ? '' : ` step=${run.current_step}`}${run.job_id === undefined ? '' : ` job=${run.job_id}`}\n  ${run.workspace} (${run.branch})`).join('\n') }]
      },
    },
    async execute(_args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('antfarm_list requires an initiating agent')
      return (await ctx.antfarm.list(caller)).map(run => ({
        run_id: run.runId,
        ...(run.jobId === undefined ? {} : { job_id: String(run.jobId) }),
        workflow_id: run.workflowId,
        status: run.status,
        workspace: run.workspace,
        branch: run.branch,
        ...(run.currentStep === undefined ? {} : { current_step: run.currentStep }),
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'antfarm_status',
    description: 'Inspect durable status, context, and story progress for one antfarm run owned by this session.',
    parameters: { run_id: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          run_id: { type: 'string', required: true },
          workflow_id: { type: 'string', required: true },
          status: { type: 'string', required: true },
          workspace: { type: 'string', required: true },
          branch: { type: 'string', required: true },
          current_step: { type: 'string' },
          context: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { key: { type: 'string', required: true }, value: { type: 'string', required: true } } } },
          stories: { type: 'array', required: true, items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string', required: true }, title: { type: 'string', required: true }, status: { type: 'string', required: true }, retry_count: { type: 'number', required: true }, feedback: { type: 'string' } } } },
        },
      },
      render(_args, value): ContentBlock[] {
        const storyLines = value.stories.map(story => `- ${story.id} [${story.status}] retries=${story.retry_count}${story.feedback === undefined ? '' : `: ${story.feedback}`}`)
        return [{ type: 'text', text: `Antfarm run ${value.run_id} is ${value.status}.\nWorkflow: ${value.workflow_id}\nWorkspace: ${value.workspace}\nBranch: ${value.branch}${value.current_step === undefined ? '' : `\nCurrent step: ${value.current_step}`}${storyLines.length === 0 ? '' : `\nStories:\n${storyLines.join('\n')}`}` }]
      },
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('antfarm_status requires an initiating agent')
      const status = await ctx.antfarm.status(args.run_id, caller)
      return {
        run_id: status.summary.runId,
        workflow_id: status.summary.workflowId,
        status: status.summary.status,
        workspace: status.summary.workspace,
        branch: status.summary.branch,
        ...(status.summary.currentStep === undefined ? {} : { current_step: status.summary.currentStep }),
        context: Object.entries(status.context).map(([key, value]) => ({ key, value })),
        stories: status.stories.map(story => ({ id: story.id, title: story.title, status: story.status, retry_count: story.retryCount, ...(story.feedback === undefined ? {} : { feedback: story.feedback }) })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'antfarm_resume',
    description: 'Resume one blocked or interrupted antfarm run owned by this session as a new background job.',
    parameters: {
      run_id: { type: 'string', required: true },
      guidance: { type: 'string', description: 'Optional human guidance supplied to the resumed step.' },
    },
    output: {
      schema: runOutput,
      render(_args, value): ContentBlock[] {
        return [{ type: 'text', text: `Antfarm run ${value.run_id} resumed as job ${value.job_id}.\nWorkspace: ${value.workspace}\nBranch: ${value.branch}` }]
      },
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('antfarm_resume requires an initiating agent')
      const receipt = await ctx.antfarm.resume({ runId: args.run_id, parent, ...(args.guidance === undefined ? {} : { guidance: args.guidance }), signal: exec.signal })
      return { run_id: receipt.runId, job_id: String(receipt.jobId), workflow_id: receipt.workflowId, status: receipt.status, workspace: receipt.workspace, branch: receipt.branch }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'antfarm_cancel',
    description: 'Cancel one active, blocked, or interrupted antfarm run owned by this session.',
    parameters: {
      run_id: { type: 'string', required: true },
      reason: { type: 'string', description: 'Cancellation reason recorded in the run journal.' },
    },
    output: {
      schema: summaryOutput,
      render(_args, value): ContentBlock[] {
        return [{ type: 'text', text: `Cancellation requested for antfarm run ${value.run_id}.\nCurrent status: ${value.status}\nWorkspace: ${value.workspace}` }]
      },
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('antfarm_cancel requires an initiating agent')
      const summary = await ctx.antfarm.cancel(args.run_id, caller, args.reason)
      return { run_id: summary.runId, status: summary.status, workspace: summary.workspace, branch: summary.branch }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'antfarm_cleanup',
    description: 'Attempt clean-only removal of a retained antfarm worktree owned by this session.',
    parameters: { run_id: { type: 'string', required: true } },
    output: {
      schema: summaryOutput,
      render(_args, value): ContentBlock[] {
        return [{ type: 'text', text: `Clean-only workspace cleanup checked antfarm run ${value.run_id}.\nRun status: ${value.status}\nWorkspace: ${value.workspace}` }]
      },
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined) throw new Error('antfarm_cleanup requires an initiating agent')
      const summary = await ctx.antfarm.cleanup(args.run_id, caller)
      return { run_id: summary.runId, status: summary.status, workspace: summary.workspace, branch: summary.branch }
    },
  }))
}
