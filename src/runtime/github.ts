/** Verify declared GitHub delivery through read-only queries after native tool effects. */
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { z } from 'zod'
import type { RunStartData } from '../persistence/types.ts'
import { runExecutable, runGit } from '../workspace/git.ts'

const pullRequest = z.object({ url: z.string().url(), headRefOid: z.string().regex(/^[a-f0-9]{40,64}$/), headRefName: z.string(), state: z.literal('OPEN'), author: z.object({ login: z.string() }), reviews: z.array(z.object({ id: z.string(), author: z.object({ login: z.string() }).nullable(), state: z.string(), commit: z.object({ oid: z.string() }) })) })

/** Host checks remote facts; publishing and reviewing remain native role-tool operations. */
export class GitHubDelivery {
  /** @param subprocess - Host subprocess owner. */
  constructor(private readonly subprocess: SubprocessRuntime) {}

  private async query(start: RunStartData, effect: 'pull-request' | 'github-review', args: readonly string[], signal: AbortSignal) {
    const ref = effect === 'github-review' ? start.githubReviewerTokenEnv : undefined
    if (ref !== undefined && (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref) || process.env[ref] === undefined)) throw new Error('the configured native reviewer credential reference is unavailable')
    return runExecutable(this.subprocess, 'gh', start.workspace, args, signal, ref === undefined ? undefined : { GH_TOKEN: process.env[ref]! })
  }

  /** @param start - Owned branch. @param effect - Upcoming declared operation. @param signal - Run lifetime. @returns Current GitHub actor without changing global credentials. */
  async preflight(start: RunStartData, effect: 'pull-request' | 'github-review', signal: AbortSignal): Promise<string> {
    const actor = await this.query(start, effect, ['api', 'user', '--jq', '.login'], signal)
    const repository = await this.query(start, effect, ['repo', 'view', '--json', 'viewerPermission'], signal)
    if (actor.exitCode !== 0 || actor.stdout.trim() === '' || repository.exitCode !== 0) throw new Error('GitHub authentication or repository access is unavailable; configure the native role environment')
    const permission = z.object({ viewerPermission: z.enum(['WRITE', 'MAINTAIN', 'ADMIN']) }).safeParse(JSON.parse(repository.stdout))
    if (!permission.success) throw new Error('the GitHub actor needs write permission for the declared PR or review operation')
    if (effect === 'github-review') {
      const result = await this.query(start, effect, ['pr', 'view', start.branch, '--json', 'url,headRefOid,headRefName,state,author,reviews'], signal)
      if (result.exitCode !== 0) throw new Error('create and verify the candidate PR before its GitHub review')
      const pr = pullRequest.parse(JSON.parse(result.stdout))
      if (pr.author.login === actor.stdout.trim() && approvingReview(pr) === undefined) throw new Error('GitHub prevents self-approval; obtain an approving human review on this PR head, then resume, or configure a distinct native reviewer identity')
    }
    return actor.stdout.trim()
  }

  /** @param start - Saved Run identity. @param effect - Declared delivery phase. @param values - Child's claimed references. @param signal - Run lifetime. @returns Verified PR references. */
  async verify(start: RunStartData, effect: 'pull-request' | 'github-review', values: Readonly<Record<string, string>>, signal: AbortSignal): Promise<Record<string, string>> {
    const dirty = await runGit(this.subprocess, start.workspace, ['status', '--porcelain'], signal)
    const head = await runGit(this.subprocess, start.workspace, ['rev-parse', 'HEAD'], signal)
    if (dirty.exitCode !== 0 || dirty.stdout.trim() !== '' || head.exitCode !== 0) throw new Error('commit and check the complete candidate before GitHub delivery')
    const result = await this.query(start, effect, ['pr', 'view', start.branch, '--json', 'url,headRefOid,headRefName,state,author,reviews'], signal)
    if (result.exitCode !== 0) throw new Error('GitHub delivery could not be verified; inspect authentication and the retained branch')
    const pr = pullRequest.parse(JSON.parse(result.stdout))
    if (pr.headRefOid !== head.stdout.trim() || pr.headRefName !== start.branch || (values['pr_url'] !== undefined && values['pr_url'] !== pr.url)) throw new Error('PR head or branch differs from the accepted candidate')
    const refs: Record<string, string> = { pr_url: pr.url, pr_head: pr.headRefOid, pr_author: pr.author.login }
    if (effect === 'github-review') {
      const review = approvingReview(pr, values['review_id'])
      if (review === undefined) throw new Error('publish an approving review for this PR head using a reviewer identity distinct from the PR author')
      refs['review_id'] = review.id
    }
    return refs
  }
}

function approvingReview(pr: z.infer<typeof pullRequest>, reviewId?: string) {
  const latest = new Map<string, (typeof pr.reviews)[number]>()
  for (const review of pr.reviews) if (review.author !== null && review.state !== 'PENDING' && review.state !== 'COMMENTED') latest.set(review.author.login, review)
  return [...latest.values()].find(review => review.commit.oid === pr.headRefOid && review.state === 'APPROVED' && review.author?.login !== pr.author.login && (reviewId === undefined || reviewId === review.id))
}
