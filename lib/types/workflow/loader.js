/** Parse original YAML and read role resources within the selected source root. */
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { publicWebhookUrl } from "./notifications.js";
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const fail = z.object({
    retry_step: id.optional(),
    max_retries: z.number().int().nonnegative().optional(),
    escalate_to: z.string().optional(),
    on_exhausted: z.object({ escalate_to: z.string().optional() }).optional(),
});
const schema = z.object({
    id,
    name: z.string().optional(),
    version: z.number().int().positive().default(1),
    description: z.string().optional(),
    context: z.record(z.string(), z.string()).default({}),
    polling: z.object({ model: z.string().optional(), timeoutSeconds: z.number().positive().optional() }).optional(),
    cron: z.object({ interval_ms: z.number().int().positive() }).optional(),
    notifications: z.object({ url: z.string().url().optional() }).optional(),
    agents: z
        .array(z.object({
        id,
        name: z.string().optional(),
        role: z.enum(['analysis', 'coding', 'verification', 'testing', 'pr', 'scanning']).optional(),
        description: z.string().optional(),
        model: z.string().optional(),
        pollingModel: z.string().optional(),
        timeoutSeconds: z.number().int().positive().max(2147483).optional(),
        workspace: z.object({
            baseDir: z.string().min(1),
            files: z.record(z.string(), z.string().min(1)),
            skills: z.array(z.string()).optional(),
        }),
    }))
        .min(1),
    steps: z
        .array(z.object({
        id,
        agent: id,
        type: z.enum(['single', 'loop']).default('single'),
        input: z.string().min(1),
        expects: z.string().min(1),
        max_retries: z.number().int().nonnegative().optional(),
        on_fail: fail.optional(),
        loop: z
            .object({
            over: z.literal('stories'),
            completion: z.literal('all_done'),
            fresh_session: z.boolean().optional(),
            freshSession: z.boolean().optional(),
            verify_each: z.boolean().optional(),
            verifyEach: z.boolean().optional(),
            verify_step: id.optional(),
            verifyStep: id.optional(),
        })
            .optional(),
    }))
        .min(1),
});
/**
 * Parse editable original YAML with the same shape used by workflow loading.
 * @param document - Original workflow YAML.
 * @returns Validated document fields.
 */
export function parseWorkflowDocument(document) {
    return schema.parse(parse(document));
}
function validateReferences(workflow) {
    const names = new Set(workflow.agents.map((agent) => agent.id));
    const stepIds = new Set(workflow.steps.map((step) => step.id));
    if (names.size !== workflow.agents.length || stepIds.size !== workflow.steps.length)
        throw new Error('duplicate workflow agent or step id');
    for (const agent of workflow.agents) {
        if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes('..'))
            throw new Error('agent workspace must remain a relative child directory');
        for (const name of Object.keys(agent.files))
            if (isAbsolute(name) || name.split(/[\\/]/).includes('..'))
                throw new Error('agent file must remain within its workspace');
    }
    for (const step of workflow.steps) {
        if (!names.has(step.agent))
            throw new Error(`unknown agent ${step.agent}`);
        if (step.type === 'loop' && step.loop === undefined)
            throw new Error('loop step requires loop configuration');
        if (step.loop?.verifyEach && (!step.loop.verifyStep || !stepIds.has(step.loop.verifyStep)))
            throw new Error('loop verification step is missing');
        if (step.on_fail?.retry_step && !stepIds.has(step.on_fail.retry_step))
            throw new Error('retry step is missing');
    }
}
/** @param name - Original agent id. @returns Original inferred tool role. */
export function inferRole(name) {
    if (/planner|prioritizer|reviewer|investigator|triager/.test(name))
        return 'analysis';
    if (name.includes('verifier'))
        return 'verification';
    if (name.includes('tester'))
        return 'testing';
    if (name.includes('scanner'))
        return 'scanning';
    return name === 'pr' ? 'pr' : 'coding';
}
/** @param document - Original YAML. @param directory - Its directory. @param sourceRoot - Allowed resource root. @returns Resolved identity and workflow snapshot. */
export async function parseWorkflow(document, directory, sourceRoot) {
    const value = parseWorkflowDocument(document);
    if (value.notifications?.url)
        publicWebhookUrl(value.notifications.url);
    const root = await realpath(sourceRoot);
    const sourceDirectory = await realpath(directory);
    const confined = async (path) => {
        const canonical = await realpath(path);
        const rel = relative(root, canonical);
        if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
            throw new Error('workflow resource escapes its selected source root');
        return canonical;
    };
    await confined(directory);
    const agents = await Promise.all(value.agents.map(async (agent) => {
        if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes('..'))
            throw new Error('agent workspace must remain a relative child directory');
        const files = {};
        for (const [name, path] of Object.entries(agent.workspace.files)) {
            if (isAbsolute(name) || name.split(/[\\/]/).includes('..'))
                throw new Error('agent file must remain within its workspace');
            const content = await readFile(await confined(resolve(sourceDirectory, path)), 'utf8');
            if (Buffer.byteLength(content) > 65536)
                throw new Error('agent resource exceeds 64 KiB');
            files[name] = content;
        }
        const role = agent.role ?? inferRole(agent.id);
        return {
            ...agent,
            name: agent.name ?? agent.id,
            role,
            timeoutSeconds: agent.timeoutSeconds ?? (role === 'coding' || role === 'testing' ? 1800 : 1200),
            files,
        };
    }));
    const steps = value.steps.map((step) => ({
        ...step,
        max_retries: step.max_retries ?? step.on_fail?.max_retries ?? 2,
        ...(step.loop === undefined
            ? {}
            : {
                loop: {
                    over: step.loop.over,
                    completion: step.loop.completion,
                    freshSession: step.loop.fresh_session ?? step.loop.freshSession ?? true,
                    verifyEach: step.loop.verify_each ?? step.loop.verifyEach ?? false,
                    ...(step.loop.verify_step === undefined && step.loop.verifyStep === undefined
                        ? {}
                        : { verifyStep: step.loop.verify_step ?? step.loop.verifyStep }),
                },
            }),
    }));
    validateReferences({ agents, steps });
    return { ...value, name: value.name ?? value.id, agents, steps, sourceDirectory, document };
}
/** @param id - Workflow directory name. @param roots - Precedence-ordered registries. @returns Resolved original workflow. */
export async function loadWorkflow(id, roots) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
        throw new Error('invalid workflow id');
    for (const root of roots) {
        const directory = join(root, id);
        let document;
        try {
            document = await readFile(join(directory, 'workflow.yml'), 'utf8');
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
                continue;
            throw error;
        }
        // The official package keeps shared agents beside workflows, as upstream does.
        const sourceRoot = root.endsWith(`${sep}workflows`) ? dirname(root) : root;
        const workflow = await parseWorkflow(document, directory, sourceRoot);
        if (workflow.id !== id)
            throw new Error('workflow id differs from directory');
        return workflow;
    }
    throw new Error(`workflow ${id} was not found`);
}
/** @param value - Saved resolved workflow. @returns Checked native storage value. */
export function validateResolvedWorkflow(value) {
    const saved = schema
        .extend({
        name: z.string(),
        document: z.string(),
        sourceDirectory: z.string(),
        agents: z.array(schema.shape.agents.element.extend({
            name: z.string(),
            role: z.enum(['analysis', 'coding', 'verification', 'testing', 'pr', 'scanning']),
            timeoutSeconds: z.number().int().positive().max(2147483),
            files: z.record(z.string(), z.string()),
        })).min(1),
        steps: z.array(schema.shape.steps.element.extend({ max_retries: z.number().int().nonnegative() })).min(1),
    })
        .parse(value);
    validateReferences(saved);
    if (saved.notifications?.url)
        publicWebhookUrl(saved.notifications.url);
    return saved;
}
//# sourceMappingURL=loader.js.map