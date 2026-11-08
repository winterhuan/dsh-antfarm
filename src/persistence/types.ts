/** Story rows presented by original SQLite runs and read-only historical snapshots. */
import type { Story } from '../workflow/types.ts'

/** Completion, retries and original worker feedback for one story. */
export interface FoldedStory extends Story {
  readonly status: 'pending' | 'running' | 'done' | 'retry' | 'failed'
  readonly retryCount: number
  readonly feedback?: string | undefined
}
