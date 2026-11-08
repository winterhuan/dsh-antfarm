/** Original Antfarm workflow definitions; role identities outlive their DSH attempts. */
export type AgentRole = 'analysis' | 'coding' | 'verification' | 'testing' | 'pr' | 'scanning'
/** An installed identity, its persona files and its original workspace declaration. */
export interface ResolvedAgent {
  readonly id: string
  readonly name: string
  readonly role: AgentRole
  readonly description?: string | undefined
  readonly model?: string | undefined
  readonly pollingModel?: string | undefined
  readonly timeoutSeconds: number
  readonly workspace: {
    readonly baseDir: string
    readonly files: Readonly<Record<string, string>>
    readonly skills?: readonly string[] | undefined
  }
  readonly files: Readonly<Record<string, string>>
}
/** Original failure policy. */
export interface ResolvedOnFail {
  readonly retry_step?: string | undefined
  readonly max_retries?: number | undefined
  readonly escalate_to?: string | undefined
  readonly on_exhausted?: { readonly escalate_to?: string | undefined } | undefined
}
/** Normalized aliases for the original loop declaration. */
export interface LoopConfig {
  readonly over: 'stories'
  readonly completion: 'all_done'
  readonly freshSession?: boolean | undefined
  readonly verifyEach?: boolean | undefined
  readonly verifyStep?: string | undefined
}
/** Original step input and output protocol. */
export interface ResolvedStep {
  readonly id: string
  readonly agent: string
  readonly type: 'single' | 'loop'
  readonly input: string
  readonly expects: string
  readonly max_retries: number
  readonly on_fail?: ResolvedOnFail | undefined
  readonly loop?: LoopConfig | undefined
}
/** Story result used by the UI and legacy reader. */
export interface Story {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly acceptanceCriteria: readonly string[]
  readonly maxRetries: number
}
/** Resolved original document and resource snapshot. */
export interface ResolvedWorkflow {
  readonly id: string
  readonly name: string
  readonly version: number
  readonly description?: string | undefined
  readonly agents: readonly ResolvedAgent[]
  readonly steps: readonly ResolvedStep[]
  readonly sourceDirectory: string
  readonly document: string
  readonly context: Readonly<Record<string, string>>
  readonly polling?: { readonly model?: string | undefined; readonly timeoutSeconds?: number | undefined } | undefined
  readonly cron?: { readonly interval_ms: number } | undefined
  readonly notifications?: { readonly url?: string | undefined } | undefined
}
/** Original YAML plus self-contained role resources for the workflow editor. */
export interface WorkflowDraft {
  readonly id: string
  readonly document: string
  readonly files: Readonly<Record<string, string>>
  readonly revision: string
  readonly sourceDirectory?: string | undefined
  readonly enabled?: boolean | undefined
}
