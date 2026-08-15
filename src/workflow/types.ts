/** Agent roles accepted by antfarm workflows. */
export type AgentRole = 'analysis' | 'coding' | 'verification' | 'testing' | 'pr' | 'scanning'

/** Fully resolved agent content used to create one child. */
export interface ResolvedAgent {
  readonly id: string
  readonly name: string
  readonly role: AgentRole
  readonly model?: string
  readonly timeoutSeconds?: number
  readonly skills: readonly string[]
  readonly persona: string
  readonly instructions: string
}

/** Escalation behavior after a bounded retry budget is exhausted. */
export interface ResolvedOnExhausted { readonly escalateTo?: 'human' }

/** A top-level failure feedback edge. */
export interface ResolvedOnFail {
  readonly retryStep?: string
  readonly maxRetries: number
  readonly onExhausted: ResolvedOnExhausted
}

/** One serial single-agent step. */
export interface ResolvedSingleStep {
  readonly id: string
  readonly agent: string
  readonly type: 'single'
  readonly input: string
  readonly expects?: string
  readonly maxRetries: number
  readonly onFail?: ResolvedOnFail
}

/** One per-story implementation loop. */
export interface ResolvedLoopStep {
  readonly id: string
  readonly agent: string
  readonly type: 'loop'
  readonly over: 'stories'
  readonly completion: 'all_done'
  readonly freshSession: true
  readonly input: string
  readonly expects?: string
  readonly maxRetries: number
  readonly verifyEach: boolean
  readonly verifyStep?: string
  readonly repairInput?: string
  readonly onFail?: ResolvedOnFail
}

export type ResolvedStep = ResolvedSingleStep | ResolvedLoopStep

/** One validated story emitted through STORIES_JSON. */
export interface Story {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly acceptanceCriteria: readonly string[]
  readonly maxRetries: number
}

/** Immutable workflow definition stored in run-start journal events. */
export interface ResolvedWorkflow {
  readonly id: string
  readonly name: string
  readonly version: number
  readonly description?: string
  readonly agents: readonly ResolvedAgent[]
  readonly steps: readonly ResolvedStep[]
  readonly sourceDirectory: string
}
