import type { ResolvedWorkflow, Story } from '../workflow/types.ts'
import type { JournalEvent } from './types.ts'

export interface FoldedStory extends Story {
  readonly status: 'pending' | 'done' | 'retry' | 'failed'
  readonly retryCount: number
  readonly feedback?: string
}

export interface FoldedRun {
  readonly runId: string
  readonly workflowId: string
  readonly workflow: ResolvedWorkflow
  readonly ownerSessionId: string
  readonly status: 'active' | 'interrupted' | 'blocked' | 'completed' | 'failed' | 'cancelled'
  readonly task: string
  readonly baseCwd: string
  readonly baseRevision: string
  readonly baseStatus: string
  readonly provider: string
  readonly model?: string
  readonly isolation: 'worktree' | 'shared'
  readonly context: Readonly<Record<string, string>>
  readonly attempts: Readonly<Record<string, number>>
  readonly completedSteps: readonly string[]
  readonly currentStep?: string
  readonly openStep?: { readonly stepId: string; readonly attempt: number; readonly storyId?: string; readonly execution: 'normal' | 'story' | 'verify' | 'repair'; readonly sourceStepId?: string }
  readonly stories: readonly FoldedStory[]
  readonly blockedReason?: string
  readonly resumeGuidance?: string
  readonly resumeCount: number
  readonly workspace: string
  readonly branch: string
  readonly workspaceDisposition: 'present' | 'cleaned' | 'retained'
  readonly workspaceReason?: string
}

/** Fold one validated journal into current run state. */
export function foldJournal(events: readonly JournalEvent[]): FoldedRun {
  const first = events[0]
  if (first === undefined || first.type !== 'run-start') throw new Error('journal must begin with run-start')
  const start = first.data
  const context: Record<string, string> = { task: start.task, branch: start.branch, workspace: start.workspace }
  const attempts: Record<string, number> = {}
  const completedSteps = new Set<string>()
  const stories = new Map<string, FoldedStory>()
  let currentStep: string | undefined
  let openStep: FoldedRun['openStep']
  let status: FoldedRun['status'] = 'active'
  let blockedReason: string | undefined
  let resumeGuidance: string | undefined
  let resumeCount = 0
  let workspaceDisposition: FoldedRun['workspaceDisposition'] = 'present'
  let workspaceReason: string | undefined
  for (const event of events.slice(1)) {
    switch (event.type) {
      case 'step-start':
        currentStep = event.data.stepId
        attempts[event.data.stepId] = event.data.attempt
        if (openStep !== undefined) throw new Error(`journal contains overlapping steps at "${event.data.stepId}"`)
        openStep = {
          stepId: event.data.stepId,
          attempt: event.data.attempt,
          ...(event.data.storyId === undefined ? {} : { storyId: event.data.storyId }),
          execution: event.data.execution ?? (event.data.storyId === undefined ? 'normal' : 'story'),
          ...(event.data.sourceStepId === undefined ? {} : { sourceStepId: event.data.sourceStepId }),
        }
        break
      case 'step-end':
        if (openStep === undefined) throw new Error(`step-end for "${event.data.stepId}" has no matching step-start`)
        if (openStep.stepId !== event.data.stepId || openStep.attempt !== event.data.attempt || openStep.storyId !== event.data.storyId) {
          throw new Error(`step-end for "${event.data.stepId}" does not match its open step`)
        }
        for (const [key, value] of Object.entries(event.data.contextDelta)) context[key] = value
        if (event.data.outcome === 'done' && event.data.storyId === undefined && (event.data.execution ?? 'normal') === 'normal') completedSteps.add(event.data.stepId)
        openStep = undefined
        break
      case 'stories-registered':
        if (stories.size > 0) throw new Error('journal contains more than one stories-registered event')
        for (const item of event.data.stories) stories.set(item.id, { ...item, status: 'pending', retryCount: 0 })
        break
      case 'story-end': {
        const prior = stories.get(event.data.storyId)
        if (prior === undefined) throw new Error(`story-end references unknown story "${event.data.storyId}"`)
        stories.set(prior.id, {
          ...prior,
          status: event.data.outcome,
          retryCount: event.data.retryCount,
          ...(event.data.feedback === undefined ? {} : { feedback: event.data.feedback }),
        })
        break
      }
      case 'run-blocked':
        status = 'blocked'
        blockedReason = event.data.reason
        if (openStep !== undefined) throw new Error('run-blocked cannot be appended while a step is open')
        break
      case 'run-resume':
        if (status !== 'blocked' && status !== 'active') throw new Error('run-resume requires a blocked or interrupted run')
        openStep = undefined
        status = 'active'
        blockedReason = undefined
        resumeGuidance = event.data.guidance
        resumeCount += 1
        break
      case 'run-end':
        openStep = undefined
        status = event.data.stopReason
        break
      case 'workspace-cleaned':
        workspaceDisposition = 'cleaned'
        break
      case 'workspace-retained':
        workspaceDisposition = 'retained'
        workspaceReason = event.data.reason
        break
      case 'run-start':
        throw new Error('journal contains more than one run-start')
    }
  }
  if (status === 'active') status = 'interrupted'
  return {
    runId: start.runId,
    workflowId: start.workflowId,
    workflow: start.resolvedWorkflowSnapshot,
    ownerSessionId: start.ownerSessionId,
    status,
    task: start.task,
    baseCwd: start.baseCwd,
    baseRevision: start.baseRevision,
    baseStatus: start.baseStatus,
    provider: start.provider,
    ...(start.model === undefined ? {} : { model: start.model }),
    isolation: start.isolation,
    context,
    attempts,
    completedSteps: [...completedSteps],
    ...(currentStep === undefined ? {} : { currentStep }),
    ...(openStep === undefined ? {} : { openStep }),
    stories: [...stories.values()],
    ...(blockedReason === undefined ? {} : { blockedReason }),
    ...(resumeGuidance === undefined ? {} : { resumeGuidance }),
    resumeCount,
    workspace: start.workspace,
    branch: start.branch,
    workspaceDisposition,
    ...(workspaceReason === undefined ? {} : { workspaceReason }),
  }
}
