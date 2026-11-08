/** Deterministic original-text fixture; the native DSH loop and tools still execute. */
import { appendFile } from 'node:fs/promises'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const inject = ['llm']
export function apply(ctx, config) {
  let rootCalls = 0
  let callId = 0
  class FixtureAdapter extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'antfarm-fixture', name: 'Antfarm fixture', contextWindow: 100000, maxTokens: 16000 }] }
    async *stream(options) {
      options.signal?.throwIfAborted()
      const names = (options.tools ?? []).map(tool => tool.name)
      const context = JSON.stringify(options.messages)
      const identity = /# Antfarm identity: ([a-z0-9-]+)\/([a-z0-9-]+)/.exec(context)
      const agent = identity?.[2]
      const commands = config.byRole?.[agent] ?? config.checkCommands ?? ['pwd']
      const executed = options.messages.flatMap(message => message.content).filter(block => block.type === 'tool-call' && block.name === 'bash').length
      let name, args
      if (agent && executed < commands.length) {
        name = 'bash'; args = { description: 'Check the native agent workspace', command: commands[executed], timeoutMs: 30000, run_in_background: false }
      } else if (!agent && config.autoStart !== false && names.includes('antfarm_run') && rootCalls++ === 0) {
        name = 'antfarm_run'; args = { task: 'Verify original native workflow', workflow_id: config.workflowId ?? 'feature-dev' }
      }
      if (config.telemetryPath) await appendFile(config.telemetryPath, `${JSON.stringify({ agent, names, action: name ?? 'finish', promptBytes: Buffer.byteLength(context), toolSchemaBytes: Buffer.byteLength(JSON.stringify(options.tools ?? [])) })}\n`)
      if (name) {
        const id = `fixture-${++callId}`
        yield { type: 'block-start', index: 0, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: JSON.stringify(args) }
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: JSON.stringify(args) } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else {
        const fields = { STATUS: 'done', REPO: config.project, BRANCH: 'antfarm-fixture', TEST_CMD: 'node --test', BUILD_CMD: 'node --check fixture.js', BASELINE: 'passes', CHANGES: 'Fixture completed native Bash', TESTS: 'passes', VERIFIED: 'passes', RESULTS: 'passes', DECISION: 'approved', PR: 'https://fixture.invalid/pr/1', REGRESSION_TEST: 'native fixture', SEVERITY: 'low', AFFECTED_AREA: 'fixture', REPRODUCTION: 'fixture', PROBLEM_STATEMENT: 'fixture', ROOT_CAUSE: 'fixture', FIX_APPROACH: 'fixture', VERIFY_FEEDBACK: '', VULNERABILITY_COUNT: '1', FINDINGS: 'fixture', FIX_PLAN: 'fixture', CRITICAL_COUNT: '0', HIGH_COUNT: '0', DEFERRED: 'none', AUDIT_AFTER: 'passes' }
        if (agent === 'planner' || agent === 'prioritizer') fields.STORIES_JSON = JSON.stringify([{ id: 'S1', title: 'Native fixture', description: 'Verify fresh native execution', acceptanceCriteria: ['Native Bash exits successfully'] }])
        const text = agent ? Object.entries(fields).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}: ${value}`).join('\n') : 'Native Antfarm fixture completed.'
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text }
        yield { type: 'block-end', index: 0, block: { type: 'text', text } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['antfarm-fixture'], new FixtureAdapter()))
}
