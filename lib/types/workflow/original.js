/** Import original Antfarm documents into the native fresh-attempt runtime. */
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { publicWebhookUrl } from "./notifications.js";
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const failure = z.strictObject({ retry_step: id.optional(), max_retries: z.number().int().nonnegative().optional(), on_exhausted: z.strictObject({ escalate_to: z.literal('human').optional() }).optional(), escalate_to: z.literal('human').optional() });
const schema = z.strictObject({
    id, name: z.string().optional(), version: z.number().int().positive().optional(), description: z.string().optional(),
    polling: z.strictObject({ model: z.string().optional(), timeoutSeconds: z.number().int().positive().optional() }).optional(),
    cron: z.strictObject({ interval_ms: z.number().int().positive() }).optional(),
    context: z.record(z.string(), z.string()).optional(),
    notifications: z.strictObject({ url: z.string().url().transform(publicWebhookUrl).optional() }).optional(),
    agents: z.array(z.strictObject({
        id, name: z.string().optional(), description: z.string().optional(), role: z.enum(['analysis', 'coding', 'verification', 'testing', 'pr', 'scanning']).default('coding'),
        model: z.string().optional(), pollingModel: z.string().optional(), timeoutSeconds: z.number().int().positive().max(2147483).optional(),
        workspace: z.strictObject({ baseDir: z.string().min(1), files: z.record(z.string(), z.string().min(1)), skills: z.array(z.string().min(1)).optional() }),
    })).min(1),
    steps: z.array(z.strictObject({
        id, agent: id, type: z.enum(['single', 'loop']).optional(), input: z.string().min(1), expects: z.string().min(1), max_retries: z.number().int().nonnegative().optional(), on_fail: failure.optional(),
        loop: z.strictObject({ over: z.literal('stories'), completion: z.literal('all_done'), fresh_session: z.boolean().optional(), freshSession: z.boolean().optional(), verify_each: z.boolean().optional(), verify_step: id.optional() }).optional(),
    })).min(1),
});
/**
 * Load all role files under an explicitly selected source root; no package writes occur.
 * @param document - Original workflow YAML.
 * @param directory - Directory containing that document.
 * @param sourceRoot - Explicit import root containing shared role resources.
 * @returns Resolved snapshot preserving original metadata and declared verdicts.
 */
export async function importOriginalWorkflow(document, directory, sourceRoot, workspace = 'git') {
    const original = schema.parse(parse(document));
    const root = await realpath(sourceRoot);
    const sourceDirectory = await realpath(directory);
    const confined = async (path) => {
        const canonical = await realpath(path);
        const rel = relative(root, canonical);
        if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
            throw new Error('original workflow resource escapes its selected source root');
        return canonical;
    };
    await confined(sourceDirectory);
    const agents = await Promise.all(original.agents.map(async (agent) => {
        if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes('..'))
            throw new Error('original role workspace must be a relative child directory');
        const files = await Promise.all(Object.entries(agent.workspace.files).map(async ([name, source]) => {
            if (isAbsolute(name) || name.split(/[\\/]/).includes('..'))
                throw new Error('original role file name must remain within its workspace');
            const content = await readFile(await confined(resolve(sourceDirectory, source)), 'utf8');
            if (Buffer.byteLength(content) > 65536)
                throw new Error('original role file exceeds 64 KiB');
            return `## ${name}\n${content.trim()}`;
        }));
        const model = agent.model ?? original.polling?.model;
        const preset = agent.role === 'coding' ? 'antfarm-coding' : agent.role === 'analysis' ? 'antfarm-analysis' : `antfarm-${agent.role}`;
        return { id: agent.id, name: agent.name ?? agent.id, preset, instructions: files.join('\n\n'), role: agent.role, skills: agent.workspace.skills ?? [],
            ...(agent.description === undefined ? {} : { description: agent.description }),
            ...(model === undefined || model === 'default' ? {} : { model }),
            timeoutSeconds: agent.timeoutSeconds ?? (agent.role === 'coding' || agent.role === 'testing' ? 1800 : 1200),
        };
    }));
    const steps = original.steps.map(step => {
        const fail = step.on_fail;
        const onFail = fail === undefined ? undefined : { ...(fail.retry_step === undefined ? {} : { retryStep: fail.retry_step }), maxRetries: fail.max_retries ?? 2, onExhausted: fail.escalate_to === 'human' || fail.on_exhausted?.escalate_to === 'human' ? { escalateTo: 'human' } : {} };
        const common = { id: step.id, agent: step.agent, input: step.input, expects: step.expects, maxRetries: step.max_retries ?? fail?.max_retries ?? 2, ...(onFail === undefined ? {} : { onFail }) };
        if (step.type !== 'loop')
            return { ...common, type: 'single', output: /\bSTORIES_JSON\s*:/i.test(step.input) ? 'stories' : 'result' };
        if (step.loop === undefined)
            throw new Error('original loop step requires its loop configuration');
        return { ...common, type: 'loop', over: 'stories', completion: 'all_done', freshSession: true, verifyEach: step.loop.verify_each ?? false,
            ...(step.loop.verify_step === undefined ? {} : { verifyStep: step.loop.verify_step }), repairInput: 'Repair the retained candidate for {{task}}.\nFailures: {{issues}}\nAccepted work: {{stories_summary}}',
        };
    });
    return { id: original.id, name: original.name ?? original.id, version: 2, sourceDirectory, agents, steps, workspace,
        ...(original.description === undefined ? {} : { description: original.description }), context: original.context ?? {},
        source: { format: 'snarktank-antfarm', version: original.version ?? 1, polling: original.polling ?? {}, cron: original.cron ?? {}, notifications: original.notifications ?? {} },
    };
}
//# sourceMappingURL=original.js.map