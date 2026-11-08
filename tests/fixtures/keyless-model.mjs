/** Deterministic native-loop fixture; makes no network/model-provider requests. */
import { appendFile } from 'node:fs/promises'
import { LlmAdapter } from '@deepseek-ai/dsh-llm'

export const inject = ['llm']
export function apply(ctx, config) {
  let rootCalls = 0
  let callId = 0
  class FixtureAdapter extends LlmAdapter {
    async listModels(provider) { return [{ provider, id: 'antfarm-fixture', name: 'Antfarm Fixture', contextWindow: 100000, maxTokens: 16000 }] }
    async *stream(options) {
      options.signal?.throwIfAborted()
      const names = (options.tools ?? []).map(tool => tool.name)
      const structured = names.includes('structured_output')
      const context = JSON.stringify(options.messages)
      const selected = Object.entries(config.byRole ?? {}).find(([marker]) => context.includes(marker))?.[1]
      const commands = selected ?? config.checkCommands ?? (config.checkCommand ? [config.checkCommand] : [])
      const executed = options.messages.flatMap(message => message.content).filter(block => block.type === 'tool-call' && block.name === 'bash').length
      let name, args
      if (structured && executed < commands.length) { name = 'bash'; args = { description: 'Run the declared native evidence check', command: commands[executed], timeoutMs: 30000, run_in_background: false } }
      else if (structured) { name = 'structured_output'; args = { passed: true, summary: 'Native structured child completed.', ...(commands.length > 0 ? { checks: [{ criterion: 'Native shell exited successfully', command: commands.at(-1) }] } : {}) } }
      else if (config.autoStart !== false && names.includes('antfarm_run') && rootCalls++ === 0) { name = 'antfarm_run'; args = { task: 'Verify native structured activation', workflow_id: config.workflowId ?? 'smoke' } }
      if (config.telemetryPath) await appendFile(config.telemetryPath, `${JSON.stringify({ structured, names, action: name ?? 'finish' })}\n`)
      if (name !== undefined) {
        const id = `fixture-${++callId}`
        yield { type: 'block-start', index: 0, blockType: 'tool-call' }
        yield { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: JSON.stringify(args) }
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: JSON.stringify(args) } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      } else {
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: 'Native Antfarm acceptance completed.' }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Native Antfarm acceptance completed.' } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      }
    }
  }
  ctx.effect(() => ctx.llm.registerAdapter(['antfarm-fixture'], new FixtureAdapter()))
}
