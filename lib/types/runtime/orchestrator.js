/** Serial activation driver; only complete checkpoints accept business output. */
import { randomUUID } from 'node:crypto';
import { SessionId } from '@deepseek-ai/dsh-session';
import { z } from 'zod';
import { candidateVersion, requireCommittedCandidate } from "./evidence.js";
import { changedFrontendPaths, retainScreenshots } from "./visual.js";
import { RunJournal } from "../persistence/journal.js";
import { resolveTemplate } from "../workflow/template.js";
import { createFileWorkspace, validateFileWorkspace, retainFileOutputs } from "../workspace/files.js";
import { dirname, join } from 'node:path';
import { cleanupWorktree, createWorktree, validateWorktree } from "../workspace/git.js";
function outputSchema(planning, spec) {
    const text = { type: 'string', description: `Nonempty text, at most ${spec.maxSummaryChars} characters.` };
    return { type: 'object', additionalProperties: false,
        required: planning ? ['passed', 'summary', 'stories'] : ['passed', 'summary'],
        properties: { passed: { type: 'boolean', description: planning ? 'Whether repository analysis and the implementation plan are complete. Implementation, tests and delivery happen in later steps and need not be complete now.' : 'Whether the work assigned to this step is complete and its required checks passed.' }, blocked: { type: 'boolean', description: 'Set true when credentials, browser capability or a human decision is required for this step to proceed.' }, summary: text, screenshots: { type: 'array', items: { type: 'string' }, description: 'Relative PNG/JPEG screenshot paths from your successful native browser command when frontend checking is required.' }, checks: { type: 'array', description: 'For each acceptance criterion, cite the Antfarm execution reference from a successful bash result as call_id. Alternatively supply the complete command verbatim, including every line. One execution may cover several criteria.', items: { type: 'object', additionalProperties: false, required: ['criterion'], properties: { call_id: { type: 'string', description: 'Antfarm execution reference from a successful bash result. Supply this or the complete command.' }, criterion: { ...text, description: 'Copy a supplied acceptance criterion verbatim. If no criteria were supplied, describe the checked condition.' }, command: text } } }, values: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value'], properties: { key: { type: 'string' }, value: text } }, description: 'Named KEY values requested by the step, with unique lowercase keys. Include status and verdict fields when declared.' },
            ...planning ? { stories: { type: 'array', description: `At most ${spec.maxStories} unique implementation stories; an empty list is allowed. Keep descriptions and criteria about implementation behavior and tests. Independent verification, PR delivery and review belong to separate workflow steps, not story work or criteria.`, items: {
                        type: 'object', additionalProperties: false, required: ['id', 'title', 'description', 'acceptanceCriteria', 'maxRetries'],
                        properties: { id: { type: 'string', description: 'Unique alphanumeric id with dots, underscores or hyphens, at most 100 characters.' }, title: text, description: text,
                            acceptanceCriteria: { type: 'array', description: 'One to twenty nonempty acceptance criteria.', items: text },
                            maxRetries: { type: 'integer', description: `Retry limit between zero and ${spec.maxStoryRetries}.` } },
                    } } } : {},
        },
    };
}
function parseOutput(value, planning, spec) {
    const text = z.string().trim().min(1).max(spec.maxSummaryChars);
    const base = z.strictObject({ passed: z.boolean(), blocked: z.boolean().optional(), summary: text, screenshots: z.array(z.string().min(1)).max(10).optional(), checks: z.array(z.strictObject({ criterion: text, command: text.optional(), call_id: z.string().min(1).max(256).optional() }).refine(check => check.command !== undefined || check.call_id !== undefined, 'check requires an execution reference or complete command').transform(({ call_id, ...check }) => ({ ...check, ...(call_id === undefined ? {} : { callId: call_id }) }))).max(200).optional(), values: z.array(z.strictObject({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), value: text })).max(100).refine(rows => new Set(rows.map(row => row.key)).size === rows.length, 'duplicate handoff keys').transform(rows => Object.fromEntries(rows.map(row => [row.key, row.value]))).optional() });
    if (!planning)
        return base.parse(value);
    const result = base.extend({ stories: z.array(z.strictObject({ id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/).max(100), title: text, description: text, acceptanceCriteria: z.array(text).min(1).max(20), maxRetries: z.number().int().min(0).max(spec.maxStoryRetries) })).max(spec.maxStories) }).parse(value);
    if (new Set(result.stories.map(story => story.id)).size !== result.stories.length)
        throw new Error('planner returned duplicate story ids');
    return result;
}
function errorText(error, limit) {
    return (error instanceof Error ? error.message : String(error)).slice(0, limit);
}
function deadline(parent, seconds) {
    parent.throwIfAborted();
    const timer = new AbortController();
    const handle = setTimeout(() => timer.abort(new Error('step deadline exceeded')), seconds * 1000);
    return { signal: AbortSignal.any([parent, timer.signal]), dispose: () => clearTimeout(handle) };
}
/**
 * Execute an admitted workflow and settle only after child and workspace teardown.
 * @param dependencies - Host child and process execution services.
 * @param spec - The sole driver's journal, authority, and cancellation lifetime.
 * @returns Job outcome; blocked runs end their job while retaining resumable checkpoints.
 */
export async function runWorkflow(dependencies, spec) {
    const { journal } = spec;
    const start = journal.state.start;
    const workflow = start.resolvedWorkflowSnapshot;
    const write = async (record) => { await journal.append(record); const revision = journal.revision; spec.onChange(); await dependencies.onEvent?.(record, revision); };
    const commit = (checkpoint) => write({ type: 'checkpoint', data: checkpoint });
    const contextFor = (extra = {}) => ({ ...workflow.context, ...journal.state.checkpoint.context, task: start.task, repo: start.workspace, completed_stories: JSON.stringify((journal.state.checkpoint.stories ?? []).filter(story => story.status === 'done')), stories_remaining: String((journal.state.checkpoint.stories ?? []).filter(story => story.status !== 'done').length), progress: JSON.stringify(journal.state.checkpoint.context), branch: start.branch, workspace: start.workspace, resume_guidance: journal.state.resumeGuidance, current_story: '', verify_feedback: '', changes: journal.state.checkpoint.context['changes'] ?? JSON.stringify((journal.state.checkpoint.stories ?? []).filter(story => story.status === 'done')), issues: '', stories_summary: JSON.stringify(journal.state.checkpoint.stories ?? []), results: JSON.stringify(journal.state.checkpoint.context), ...extra });
    const agentFor = (step) => {
        const agent = workflow.agents.find(candidate => candidate.id === step.agent);
        if (agent === undefined)
            throw new Error(`step ${step.id} has no agent`);
        return agent;
    };
    const child = async (step, execution, extra = {}, storyId, input = step.input) => {
        spec.signal.throwIfAborted();
        if (journal.state.childSessionIds.length >= (spec.maxAttempts ?? 500) + journal.state.retryGrant)
            throw new Error('total native attempt budget exhausted; grant recovery budget after inspecting this Run');
        const agent = agentFor(step);
        const guidance = journal.state.resumeGuidance;
        const frontend = step.type === 'single' && step.requireVisuals ? await changedFrontendPaths(dependencies.subprocess, start, spec.signal) : [];
        const criteria = storyId === undefined ? (journal.state.checkpoint.stories ?? []).flatMap(story => story.acceptanceCriteria) : journal.state.checkpoint.stories?.find(story => story.id === storyId)?.acceptanceCriteria ?? [];
        const reviewCredentials = step.type === 'single' && step.effect === 'github-review' && start.githubReviewerTokenEnv !== undefined ? `For gh review commands, set GH_TOKEN from the existing environment variable ${start.githubReviewerTokenEnv} only for that command. Never print the credential or change global accounts.\n` : '';
        const workspaceInstructions = start.workspaceKind === 'files' ? 'Use the supplied owned file workspace and its immutable inputs.' : 'Use the supplied owned workspace and branch; they are already created.';
        const retryFeedback = execution === 'single' ? journal.state.checkpoint.feedback[step.id] ?? '' : '';
        const prompt = `${reviewCredentials}${frontend.length === 0 ? '' : `Frontend changes: ${JSON.stringify(frontend)}. Run native browser checks using playwright, puppeteer, cypress or ego-browser; inspect rendered behavior and visual quality. Save PNG/JPEG screenshots in a Git-ignored output directory and return relative paths in screenshots. If necessary, add only that output directory to the repository-local Git exclude; do not edit tracked ignore files or candidate source during checks. Reuse any browser session supplied by the task and leave it open for subsequent steps; do not close or transfer that shared session. Missing browser capability requires passed=false and blocked=true.\n`}${workspaceInstructions} Return a structured result and include requested KEY values in values.${step.requireChecks ? `\nVerification requires actual native shell checks for every criterion. Copy each criterion verbatim into checks[].criterion and cite the Antfarm execution reference from its bash result as checks[].call_id. Alternatively cite the complete command verbatim. Criteria: ${JSON.stringify(criteria)}` : ''}\n${agent.instructions}${retryFeedback === '' ? '' : `\nPrevious rejected attempt for this step:\n${retryFeedback}`}${(agent.skills?.length ?? 0) === 0 ? '' : `\nRequired skills: ${agent.skills.join(', ')}. Load them through the native skill tool before using them.`}\n\n${resolveTemplate(input, contextFor(extra))}${guidance === '' ? '' : `\n\nHuman reconciliation guidance:\n${guidance}`}`;
        if (prompt.length > 262144)
            throw new Error('assembled Antfarm input exceeds 262144 characters; provide bounded handoffs');
        const childId = SessionId(randomUUID());
        const planning = step.type === 'single' && step.output === 'stories' && execution === 'single';
        const releaseAttempt = await dependencies.acquireAttempt?.();
        let clock;
        try {
            clock = deadline(spec.signal, agent.timeoutSeconds ?? spec.timeoutSeconds);
        }
        catch (error) {
            releaseAttempt?.();
            throw error;
        }
        let result;
        let deliveryBlocked = false;
        dependencies.evidence?.begin(childId, journal, step.id);
        try {
            await write({ type: 'attempt-start', data: { stepId: step.id, childSessionId: childId, execution, ...storyId === undefined ? {} : { storyId }, ...(step.type === 'single' && step.effect !== undefined ? { effect: step.effect, candidate: await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind) } : {}) } });
            if (step.type === 'single' && step.effect !== undefined) {
                deliveryBlocked = true;
                if (dependencies.delivery === undefined)
                    throw new Error('GitHub delivery verification is unavailable');
                await dependencies.delivery.preflight(start, step.effect, clock.signal);
                deliveryBlocked = false;
            }
            if (step.requireChecks && start.workspaceKind !== 'files')
                await requireCommittedCandidate(dependencies.subprocess, start.workspace);
            clock.signal.throwIfAborted();
            const activation = await dependencies.subagents.startActivation({
                provider: start.provider, label: agent.name, childId, delivery: 'caller', signal: clock.signal,
                request: { parent: spec.parent, cwd: start.workspace, agentPreset: agent.preset, prompt: [{ type: 'text', text: prompt }], outputSchema: outputSchema(planning, spec), ...agent.model === undefined ? {} : { agentOptions: { model: agent.model } } },
            });
            let disposal;
            const dispose = () => disposal ??= activation.dispose();
            let abort;
            const interrupted = new Promise((_resolve, reject) => { abort = reject; });
            const onAbort = () => { abort(clock.signal.reason); void dispose().catch(() => { }); };
            clock.signal.addEventListener('abort', onAbort, { once: true });
            if (clock.signal.aborted)
                onAbort();
            try {
                const outcome = await Promise.race([activation.result, interrupted]);
                clock.signal.throwIfAborted();
                if (outcome.stopReason !== 'completed')
                    throw new Error(outcome.diagnostic ?? `child stopped with ${outcome.stopReason}`);
                result = parseOutput(outcome.structured, planning, spec);
                if (result.passed && step.expects !== undefined) {
                    for (const line of step.expects.split('\n').filter(line => line.trim() !== '')) {
                        const match = /^([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(line.trim());
                        if (match === null || result.values?.[match[1].toLowerCase()] !== match[2])
                            throw new Error(`required verdict missing or different: ${line}`);
                    }
                }
            }
            finally {
                clock.signal.removeEventListener('abort', onAbort);
                await dispose();
            }
            const records = await dependencies.evidence?.finish(childId) ?? [];
            if (result.passed && planning && result.stories?.length === 0 && workflow.allowEmptyPlan === false)
                throw new Error('this workflow requires a nonempty implementation plan');
            if (result.passed && step.requireChecks) {
                if (start.workspaceKind !== 'files')
                    await requireCommittedCandidate(dependencies.subprocess, start.workspace);
                const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
                const referenced = (result.checks ?? []).map(check => records.find(record => (check.callId === undefined || record.callId === check.callId) && (check.command === undefined || record.command === check.command) && record.passed && record.candidate === version && record.afterCandidate === version));
                const missingCriteria = criteria.filter(criterion => !result.checks?.some(check => check.criterion === criterion));
                const unmatchedCommands = (result.checks ?? []).filter((_check, index) => referenced[index] === undefined).map(check => check.callId ?? check.command);
                if (referenced.length === 0 || unmatchedCommands.length > 0 || missingCriteria.length > 0)
                    throw new Error(`required acceptance criteria lack actual successful execution evidence for this candidate. Missing verbatim criteria: ${JSON.stringify(missingCriteria).slice(0, 2048)}. Unmatched execution references: ${JSON.stringify(unmatchedCommands).slice(0, 2048)}. Execute foreground bash checks in the supplied workspace and cite every command line exactly.`);
                result = { ...result, proof: { candidate: version, callIds: referenced.flatMap(record => record === undefined ? [] : [record.callId]) } };
            }
            if (result.passed && frontend.length > 0) {
                const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
                const artifacts = await retainScreenshots(start.workspace, result.screenshots ?? [], records, version, join(dirname(journal.eventsPath), 'artifacts'));
                if (version !== await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind))
                    throw new Error('candidate changed while retaining screenshots');
                await write({ type: 'file-artifacts', data: { candidate: version, artifacts: [...new Map([...journal.state.artifacts, ...artifacts].map(artifact => [`${artifact.path}:${artifact.sha256}`, artifact])).values()] } });
            }
            if (result.passed && step.type === 'single' && step.effect !== undefined) {
                if (dependencies.delivery === undefined)
                    throw new Error('GitHub delivery verification is unavailable');
                let refs;
                try {
                    refs = await dependencies.delivery.verify(start, step.effect, { ...journal.state.checkpoint.context, ...result.values }, clock.signal);
                }
                catch (error) {
                    deliveryBlocked = true;
                    throw error;
                }
                result = { ...result, values: { ...result.values, ...refs } };
            }
            spec.signal.throwIfAborted();
        }
        catch (error) {
            if (spec.signal.aborted)
                throw error;
            result = { passed: false, blocked: deliveryBlocked, summary: errorText(error, spec.maxSummaryChars) };
        }
        finally {
            clock.dispose();
            try {
                await dependencies.evidence?.finish(childId);
            }
            finally {
                releaseAttempt?.();
            }
        }
        await write({ type: 'attempt-end', data: { childSessionId: childId, passed: result.passed, summary: result.summary } });
        return result;
    };
    const settle = async (status, reason) => {
        if (status === 'completed' && start.workspaceKind === 'files') {
            await validateFileWorkspace(start.workspace, start.runId);
            const version = await candidateVersion(dependencies.subprocess, start.workspace, 'files');
            const artifacts = await retainFileOutputs(start.workspace, join(dirname(journal.eventsPath), 'artifacts'));
            if (artifacts.length === 0)
                throw new Error('file workflow produced no retained output');
            if (version !== await candidateVersion(dependencies.subprocess, start.workspace, 'files'))
                throw new Error('file outputs changed during retention');
            await write({ type: 'file-artifacts', data: { candidate: version, artifacts } });
        }
        await write({ type: 'run-end', data: { status, reason } });
        const clean = status === 'completed' ? spec.cleanupCompleted : status === 'cancelled' && spec.cleanupCancelled;
        const disposition = clean && journal.state.prepared && spec.worktree !== null ? await cleanupWorktree(dependencies.subprocess, spec.worktree) : { disposition: 'retained', reason: reason || 'workspace retained for inspection' };
        await write({ type: 'workspace-disposition', data: { disposition: disposition.disposition, reason: disposition.reason ?? '' } });
        return { status: status === 'completed' ? 'completed' : status === 'cancelled' ? 'killed' : 'failed', detail: reason || start.runId };
    };
    const exhausted = async (checkpoint, reason, human) => {
        if (!human) {
            await commit(checkpoint);
            return settle('failed', reason);
        }
        await commit({ ...checkpoint, blocked: reason });
        await write({ type: 'workspace-disposition', data: { disposition: 'retained', reason } });
        return { status: 'completed', detail: `blocked: ${reason}` };
    };
    try {
        spec.signal.throwIfAborted();
        if (!journal.state.prepared) {
            if (spec.worktree === null)
                await createFileWorkspace(start.workspace, start.runId, start.fileInputs ?? []);
            else
                await createWorktree(dependencies.subprocess, spec.worktree, spec.signal);
            await write({ type: 'workspace-ready', data: {} });
        }
        else {
            if (spec.worktree === null)
                await validateFileWorkspace(start.workspace, start.runId);
            else
                await validateWorktree(dependencies.subprocess, spec.worktree, spec.signal);
        }
        const recovered = journal.state.checkpoint;
        if (recovered.blocked !== null) {
            await commit({ ...recovered, blocked: null, stories: recovered.stories?.map(story => story.status === 'failed' ? { ...story, status: 'retry' } : story) ?? null });
        }
        const verificationSteps = new Set(workflow.steps.flatMap(step => step.type === 'loop' && step.verifyStep !== undefined ? [step.verifyStep] : []));
        for (;;) {
            while (journal.state.checkpoint.cursor < workflow.steps.length) {
                spec.signal.throwIfAborted();
                const state = journal.state.checkpoint;
                const step = workflow.steps[state.cursor];
                if (step === undefined)
                    throw new Error('invalid workflow position');
                if (state.repair !== null) {
                    const target = workflow.steps.find(candidate => candidate.id === state.repair?.targetId);
                    if (target === undefined)
                        throw new Error('repair target is missing');
                    const repaired = await child(target, 'repair', { issues: state.feedback[step.id] ?? '', stories_summary: JSON.stringify(state.stories ?? []) }, undefined, target.type === 'loop' ? target.repairInput ?? target.input : target.input);
                    if (!repaired.passed)
                        return exhausted(state, repaired.summary, step.onFail?.onExhausted.escalateTo === 'human');
                    await commit({ ...state, repair: null, acceptedChecks: {}, cursor: Math.min(state.cursor, ...workflow.steps.map((candidate, index) => candidate.requireChecks && !verificationSteps.has(candidate.id) ? index : state.cursor)), context: { ...state.context, [`${target.id}:repair`]: repaired.summary } });
                    continue;
                }
                if (verificationSteps.has(step.id)) {
                    await commit({ ...state, cursor: state.cursor + 1 });
                    continue;
                }
                if (step.type === 'single' && step.effect !== undefined && workflow.id === 'security-audit' && state.stories?.length === 0) {
                    await commit({ ...state, cursor: state.cursor + 1, context: { ...state.context, [step.id]: 'No demonstrated findings; no remediation PR required' } });
                    continue;
                }
                if (step.type === 'loop') {
                    if (state.stories === null)
                        throw new Error(`loop ${step.id} has no committed plan`);
                    const story = state.stories.find(candidate => candidate.status !== 'done');
                    if (story === undefined) {
                        await commit({ ...state, cursor: state.cursor + 1 });
                        continue;
                    }
                    const extra = { current_story: JSON.stringify(story), verify_feedback: story.feedback ?? journal.state.resumeGuidance };
                    const implemented = await child(step, 'story', extra, story.id);
                    let verified = implemented;
                    const verifyStep = step.verifyStep === undefined ? undefined : workflow.steps.find(candidate => candidate.id === step.verifyStep);
                    if (implemented.passed && step.verifyEach && verifyStep !== undefined)
                        verified = await child(verifyStep, 'verify', { ...extra, changes: implemented.summary }, story.id);
                    const passed = implemented.passed && verified.passed;
                    if (implemented.blocked || verified.blocked)
                        return exhausted(state, verified.summary, true);
                    const updated = passed ? { ...story, status: 'done' } : { ...story, status: story.retryCount < story.maxRetries + journal.state.retryGrant ? 'retry' : 'failed', retryCount: story.retryCount + 1, feedback: verified.summary };
                    const next = { ...state, stories: state.stories.map(candidate => candidate.id === story.id ? updated : candidate), acceptedChecks: { ...state.acceptedChecks, ...(verified.proof === undefined ? {} : { [`${verifyStep?.id ?? step.id}:${story.id}`]: verified.proof }) }, context: passed ? { ...state.context, ...implemented.values, [`${step.id}:${story.id}`]: implemented.summary, ...verifyStep === undefined ? {} : { [`${verifyStep.id}:${story.id}`]: verified.summary } } : state.context };
                    if (updated.status === 'failed')
                        return exhausted(next, verified.summary, verifyStep?.onFail?.onExhausted.escalateTo === 'human' || step.onFail?.onExhausted.escalateTo === 'human');
                    await commit(next);
                    continue;
                }
                const output = await child(step, 'single', { issues: state.feedback[step.id] ?? '' });
                if (output.passed) {
                    await commit({ ...state, cursor: state.cursor + 1, acceptedChecks: { ...state.acceptedChecks, ...(output.proof === undefined ? {} : { [step.id]: output.proof }) }, context: { ...state.context, ...output.values, [step.id]: output.summary }, stories: step.output === 'stories' ? (output.stories ?? []).map(story => ({ ...story, status: 'pending', retryCount: 0 })) : state.stories });
                    continue;
                }
                const failures = state.retries[step.id] ?? 0;
                const next = { ...state, feedback: { ...state.feedback, [step.id]: output.summary }, retries: { ...state.retries, [step.id]: failures + 1 } };
                if (output.blocked || step.effect === 'pull-request')
                    return exhausted(next, output.summary, true);
                if (failures < step.maxRetries + journal.state.retryGrant) {
                    await commit(next);
                    continue;
                }
                const repairs = state.retries[`${step.id}:repair`] ?? 0;
                if (step.onFail?.retryStep !== undefined && repairs < step.onFail.maxRetries + journal.state.retryGrant) {
                    await commit({ ...next, retries: { ...next.retries, [step.id]: 0, [`${step.id}:repair`]: repairs + 1 }, repair: { targetId: step.onFail.retryStep, sourceStepId: step.id } });
                    continue;
                }
                return exhausted(next, output.summary, step.onFail?.onExhausted.escalateTo === 'human');
            }
            const finalSteps = workflow.steps.filter(step => step.type === 'single' && step.requireChecks && !verificationSteps.has(step.id));
            if (finalSteps.length === 0)
                break;
            const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
            const stale = finalSteps.find(step => journal.state.checkpoint.acceptedChecks?.[step.id]?.candidate !== version);
            if (stale === undefined)
                break;
            const cursor = workflow.steps.indexOf(stale);
            const invalid = new Set(workflow.steps.slice(cursor).map(step => step.id));
            await commit({ ...journal.state.checkpoint, cursor, acceptedChecks: Object.fromEntries(Object.entries(journal.state.checkpoint.acceptedChecks ?? {}).filter(([id]) => !invalid.has(id))), context: Object.fromEntries(Object.entries(journal.state.checkpoint.context).filter(([id]) => !invalid.has(id))) });
        }
        spec.signal.throwIfAborted();
        for (const step of workflow.steps) {
            if (step.type !== 'single' || step.effect === undefined || (workflow.id === 'security-audit' && journal.state.checkpoint.stories?.length === 0))
                continue;
            if (dependencies.delivery === undefined)
                throw new Error('GitHub delivery verification is unavailable');
            try {
                await dependencies.delivery.verify(start, step.effect, journal.state.checkpoint.context, spec.signal);
            }
            catch (error) {
                return exhausted({ ...journal.state.checkpoint, cursor: workflow.steps.indexOf(step) }, errorText(error, spec.maxSummaryChars), true);
            }
        }
        return await settle('completed', '');
    }
    catch (error) {
        if (spec.interrupted?.()) {
            await write({ type: 'run-interrupt', data: { reason: 'Host stopped; inspect any uncertain attempt before recovery' } });
            return { status: 'killed', detail: 'interrupted' };
        }
        const status = spec.signal.aborted ? 'cancelled' : 'failed';
        const reason = errorText(error, spec.maxSummaryChars);
        try {
            return await settle(status, reason);
        }
        catch (journalError) {
            return { status: 'failed', detail: `run evidence could not be committed: ${errorText(journalError, spec.maxSummaryChars)}` };
        }
    }
}
//# sourceMappingURL=orchestrator.js.map