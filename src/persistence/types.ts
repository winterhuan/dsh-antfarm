import type { ResolvedWorkflow, Story } from '../workflow/types.ts'

export type RunIsolation = 'worktree' | 'shared'
export type RunStopReason = 'completed' | 'failed' | 'cancelled'

export interface RunStartData {
  readonly runId: string
  readonly ownerSessionId: string
  readonly workflowId: string
  readonly task: string
  readonly baseCwd: string
  readonly baseRevision: string
  readonly baseStatus: string
  readonly workspace: string
  readonly branch: string
  readonly isolation: RunIsolation
  readonly provider: string
  readonly model?: string
  readonly resolvedWorkflowSnapshot: ResolvedWorkflow
}

export type StepExecutionKind = 'normal' | 'story' | 'verify' | 'repair'
export interface StepStartData {
  readonly runId: string
  readonly stepId: string
  readonly attempt: number
  readonly storyId?: string
  readonly execution?: StepExecutionKind
  readonly sourceStepId?: string
}
export interface StepEndData {
  readonly runId: string
  readonly stepId: string
  readonly attempt: number
  readonly storyId?: string
  readonly outcome: 'done' | 'failed'
  readonly contextDelta: Readonly<Record<string, string>>
  readonly childSessionId?: string
  readonly error?: string
  readonly execution?: StepExecutionKind
  readonly sourceStepId?: string
}
export interface StoriesRegisteredData { readonly runId: string; readonly stepId: string; readonly stories: readonly Story[] }
export interface StoryEndData {
  readonly runId: string
  readonly stepId: string
  readonly storyId: string
  readonly outcome: 'done' | 'retry' | 'failed'
  readonly retryCount: number
  readonly feedback?: string
}
export interface RunBlockedData { readonly runId: string; readonly stepId: string; readonly storyId?: string; readonly reason: string; readonly feedback?: string }
export interface RunResumeData {
  readonly runId: string
  readonly authority: string
  readonly guidance?: string
  readonly stepId?: string
  readonly storyId?: string
}
export interface RunEndData { readonly runId: string; readonly stopReason: RunStopReason; readonly error?: string }
export interface WorkspaceCleanedData { readonly runId: string; readonly path: string }
export interface WorkspaceRetainedData { readonly runId: string; readonly path: string; readonly reason: string }

export interface JournalEventMap {
  'run-start': RunStartData
  'step-start': StepStartData
  'step-end': StepEndData
  'stories-registered': StoriesRegisteredData
  'story-end': StoryEndData
  'run-blocked': RunBlockedData
  'run-resume': RunResumeData
  'run-end': RunEndData
  'workspace-cleaned': WorkspaceCleanedData
  'workspace-retained': WorkspaceRetainedData
}
export type JournalEventType = keyof JournalEventMap
export type JournalEventOf<T extends JournalEventType> = {
  readonly version: 1
  readonly seq: number
  readonly time: number
  readonly type: T
  readonly data: JournalEventMap[T]
}
export type JournalEvent = { [T in JournalEventType]: JournalEventOf<T> }[JournalEventType]
