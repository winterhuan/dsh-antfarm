/** Resolved version 2 workflow definitions and structured story outputs. */

/** Agent instructions paired with a deployment-owned DSH Agent Preset. */
export interface ResolvedAgent {
  readonly id: string
  readonly name: string
  readonly preset: string
  readonly instructions: string
  readonly role?: string
  readonly description?: string
  readonly skills?: readonly string[]
  readonly model?: string
  readonly timeoutSeconds?: number
}

/** Human escalation after the retry budget is exhausted. */
export interface ResolvedOnExhausted { readonly escalateTo?: 'human' }

/** A bounded repair edge to an earlier step. */
export interface ResolvedOnFail {
  readonly retryStep?: string
  readonly maxRetries: number
  readonly onExhausted: ResolvedOnExhausted
}

/** One serial child execution with a structured result. */
export interface ResolvedSingleStep {
  readonly id: string
  readonly agent: string
  readonly type: 'single'
  readonly input: string
  readonly output: 'result' | 'stories'
  readonly maxRetries: number
  readonly expects?: string
  readonly requireChecks?: boolean
  readonly effect?: 'pull-request' | 'github-review'
  readonly requireVisuals?: boolean
  readonly onFail?: ResolvedOnFail
}

/** One fresh child execution per story, with optional independent verification. */
export interface ResolvedLoopStep {
  readonly id: string
  readonly agent: string
  readonly type: 'loop'
  readonly input: string
  readonly over: 'stories'
  readonly completion: 'all_done'
  readonly freshSession: true
  readonly verifyEach: boolean
  readonly verifyStep?: string
  readonly repairInput?: string
  readonly maxRetries: number
  readonly expects?: string
  readonly requireChecks?: boolean
  readonly onFail?: ResolvedOnFail
}

/** Executable workflow step. */
export type ResolvedStep = ResolvedSingleStep | ResolvedLoopStep

/** A bounded work item returned by the planning child. */
export interface Story {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly acceptanceCriteria: readonly string[]
  readonly maxRetries: number
}

/** Complete workflow snapshot retained by each run journal. */
export interface ResolvedWorkflow {
  readonly id: string
  readonly name: string
  readonly version: 2
  readonly description?: string
  readonly agents: readonly ResolvedAgent[]
  readonly steps: readonly ResolvedStep[]
  readonly workspace?: 'git' | 'files'
  readonly inputs?: readonly string[]
  readonly allowEmptyPlan?: boolean
  readonly sourceDirectory: string
  readonly context?: Readonly<Record<string, string>>
  readonly notifications?: { readonly url?: string | undefined }
  readonly source?: { readonly format: 'snarktank-antfarm'; readonly version: number; readonly polling: { readonly model?: string | undefined; readonly timeoutSeconds?: number | undefined }; readonly cron: { readonly interval_ms?: number | undefined }; readonly notifications: { readonly url?: string | undefined } }
}

/** Self-contained editable copy; revisions bind YAML and role resources together. */
export interface WorkflowDraft {
  readonly id: string
  readonly document: string
  readonly files: Readonly<Record<string, string>>
  readonly revision: string
  readonly sourceDirectory: string
  readonly enabled?: boolean
}
