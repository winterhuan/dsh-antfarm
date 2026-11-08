/**
 * Rebuild accepted state without promoting attempt results into checkpoints.
 * @param events - Validated records in contiguous sequence order.
 * @returns State at the last durable commit; an open attempt has an uncertain outcome.
 */
export function foldJournal(events) {
    const first = events[0];
    if (first?.type !== 'run-start')
        throw new Error('journal must begin with run-start');
    const start = first.data;
    if (start.workflowId !== start.resolvedWorkflowSnapshot.id)
        throw new Error('workflow snapshot identity differs');
    const stepIds = new Set(start.resolvedWorkflowSnapshot.steps.map(step => step.id));
    let checkpoint = { cursor: 0, context: {}, stories: null, retries: {}, feedback: {}, repair: null, blocked: null };
    let status = 'queued';
    let prepared = false;
    let openAttempt = null;
    const childSessionIds = [];
    let workspaceDisposition = 'present';
    let workspaceReason = '';
    let resumeGuidance = '';
    let retryGrant = 0;
    const checks = [];
    let artifacts = [];
    let terminal = false;
    let attemptEnded = false;
    let resumed = false;
    for (const event of events.slice(1)) {
        if (terminal && !['workspace-disposition', 'tail-recovered', 'file-artifacts', 'notification', 'health'].includes(event.type) && !(status === 'failed' && event.type === 'run-resume'))
            throw new Error('journal contains execution after run settlement');
        switch (event.type) {
            case 'run-start': throw new Error('journal has more than one run-start');
            case 'run-dispatch':
                status = prepared ? 'running' : 'starting';
                break;
            case 'run-queue':
                status = 'queued';
                break;
            case 'run-interrupt':
                status = 'interrupted';
                workspaceReason = event.data.reason;
                break;
            case 'tail-recovered': break;
            case 'notification': break;
            case 'health': break;
            case 'workspace-ready':
                if (prepared)
                    throw new Error('workspace was prepared more than once');
                prepared = true;
                status = 'running';
                break;
            case 'attempt-start':
                if (!prepared)
                    throw new Error('child started before workspace readiness');
                if (openAttempt !== null && !attemptEnded && !resumed)
                    throw new Error('child attempt overlaps an unsettled child');
                if (!stepIds.has(event.data.stepId))
                    throw new Error('child references an unknown step');
                if (childSessionIds.includes(event.data.childSessionId))
                    throw new Error('child identity reused');
                attemptEnded = false;
                resumed = false;
                openAttempt = event.data;
                childSessionIds.push(event.data.childSessionId);
                status = 'running';
                break;
            case 'attempt-end':
                if (openAttempt?.childSessionId !== event.data.childSessionId)
                    throw new Error('child result has no matching attempt');
                if (attemptEnded)
                    throw new Error('child result recorded twice');
                attemptEnded = true;
                // Only a checkpoint clears uncertainty and accepts business output.
                break;
            case 'check-evidence':
                if (openAttempt?.childSessionId !== event.data.childSessionId || openAttempt.stepId !== event.data.stepId)
                    throw new Error('check evidence has no matching attempt');
                if (checks.some(check => check.callId === event.data.callId))
                    throw new Error('check evidence identity reused');
                checks.push(event.data);
                break;
            case 'checkpoint':
                if (event.data.cursor > start.resolvedWorkflowSnapshot.steps.length)
                    throw new Error('checkpoint position exceeds workflow');
                if (!prepared)
                    throw new Error('checkpoint precedes workspace readiness');
                const stories = event.data.stories;
                if (stories !== null && new Set(stories.map(story => story.id)).size !== stories.length)
                    throw new Error('checkpoint contains duplicate stories');
                if (event.data.repair !== null && (!stepIds.has(event.data.repair.targetId) || !stepIds.has(event.data.repair.sourceStepId)))
                    throw new Error('checkpoint repair references an unknown step');
                for (const proof of Object.values(event.data.acceptedChecks ?? {})) {
                    if (proof.callIds.length === 0 || proof.callIds.some(id => !checks.some(check => check.callId === id && check.passed && check.candidate === proof.candidate && check.afterCandidate === proof.candidate)))
                        throw new Error('accepted check has no committed matching execution');
                }
                checkpoint = event.data;
                openAttempt = null;
                status = checkpoint.blocked === null ? 'running' : 'blocked';
                break;
            case 'run-resume':
                if (status === 'completed' || status === 'cancelled' || workspaceDisposition === 'cleaned')
                    throw new Error('settled output cannot be resumed');
                if (status === 'failed' && (event.data.retryGrant ?? 0) < 1)
                    throw new Error('failed resume requires a retry budget grant');
                if (openAttempt !== null && event.data.guidance.trim() === '')
                    throw new Error('uncertain attempt requires reconciliation guidance');
                terminal = false;
                retryGrant += event.data.retryGrant ?? 0;
                resumed = true;
                resumeGuidance = event.data.guidance;
                status = 'queued';
                break;
            case 'run-end':
                if (event.data.status === 'completed' && (openAttempt !== null || checkpoint.cursor !== start.resolvedWorkflowSnapshot.steps.length))
                    throw new Error('completion precedes accepted workflow checkpoints');
                if (event.data.status === 'completed') {
                    const perStory = new Set(start.resolvedWorkflowSnapshot.steps.flatMap(step => step.type === 'loop' && step.verifyStep !== undefined ? [step.verifyStep] : []));
                    const proofs = start.resolvedWorkflowSnapshot.steps.filter(step => step.requireChecks && !perStory.has(step.id) && step.type === 'single').map(step => checkpoint.acceptedChecks?.[step.id]);
                    if (proofs.some(proof => proof === undefined) || new Set(proofs.map(proof => proof?.candidate)).size > 1)
                        throw new Error('completion requires all final checks on the same candidate');
                }
                status = event.data.status;
                workspaceReason = event.data.reason;
                terminal = true;
                break;
            case 'file-artifacts':
                artifacts = event.data.artifacts;
                break;
            case 'workspace-disposition':
                workspaceDisposition = event.data.disposition;
                workspaceReason = event.data.reason;
                break;
        }
    }
    return { revision: events.length - 1, start, checkpoint, status, prepared, openAttempt, childSessionIds, updatedAt: events.findLast(event => event.type !== 'notification' && event.type !== 'health')?.time ?? first.time, workspaceDisposition, workspaceReason, resumeGuidance, retryGrant, checks, artifacts };
}
//# sourceMappingURL=fold.js.map