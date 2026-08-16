import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobId } from '@deepseek-ai/dsh-jobs'
import type { ToolRestriction } from '@deepseek-ai/dsh-tools'

export interface AntfarmStartRequest {
  readonly workflowId?: string
  readonly task: string
  readonly parent: Agent
  readonly cwd?: string
  readonly provider?: string
  readonly model?: string
  readonly isolation?: 'worktree' | 'shared'
  readonly signal?: AbortSignal
}

export interface AntfarmRunReceipt {
  readonly runId: string
  readonly jobId: JobId
  readonly workflowId: string
  readonly status: 'starting'
  readonly workspace: string
  readonly branch: string
}

export interface AntfarmRunSummary {
  readonly runId: string
  readonly jobId?: JobId
  readonly workflowId: string
  readonly status: 'starting' | 'running' | 'interrupted' | 'blocked' | 'completed' | 'failed' | 'cancelled'
  readonly workspace: string
  readonly branch: string
  readonly currentStep?: string
  readonly ownerSessionId: string
}

export interface AntfarmResumeRequest {
  readonly runId: string
  readonly parent: Agent
  readonly guidance?: string
  readonly signal?: AbortSignal
}

export interface AntfarmStatus {
  readonly summary: AntfarmRunSummary
  readonly context: Readonly<Record<string, string>>
  readonly stories: readonly {
    readonly id: string
    readonly title: string
    readonly status: 'pending' | 'done' | 'retry' | 'failed'
    readonly retryCount: number
    readonly feedback?: string
  }[]
}

export type AntfarmRoleToolRestrictions = Readonly<Record<string, ToolRestriction | null>>
