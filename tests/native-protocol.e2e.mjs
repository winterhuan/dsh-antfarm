/** Run with DSH 0.2.2-rc.1 on PATH; an optional package spec tests a remote release instead of the built checkout. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import { zstdDecompressSync } from 'node:zlib'

const execute = promisify(execFile)
const repository = fileURLToPath(new URL('../', import.meta.url))
const temporary = await mkdtemp(join(tmpdir(), 'antfarm-protocol-'))
const project = join(temporary, 'project')
const env = { ...process.env, DSH_HOME: join(temporary, 'home') }
const dsh = (...args) => execute('dsh', args, { cwd: project, env, timeout: 60000, maxBuffer: 8 * 1024 * 1024 })

try {
  await mkdir(project)
  await dsh('--profile', 'antfarm-test', '--from-default-profile', 'headless', '--dump-config')
  await dsh('plugin', '--profile', 'antfarm-test', 'add', process.argv[2] ?? `link:${repository}`)
  const parent = join(temporary, 'parent.mjs')
  await writeFile(parent, `export const inject = ['agentPresets'];
export function apply(ctx) {
  ctx.on('agent/created', async ({agent}) => {
    if (agent.session.header.origin !== 'subagent') await ctx.agentPresets.mount(agent.ctx, 'standard');
  });
}
`)
  const telemetryPath = join(temporary, 'telemetry.jsonl')
  const overlay = join(temporary, 'overlay.json')
  await writeFile(overlay, JSON.stringify([
    { id: 'agent-default-model', config: { provider: 'antfarm-fixture', model: 'antfarm-fixture' } },
    { insert: [
      { id: 'agent-preset-registry', name: '@deepseek-ai/dsh-agent-preset-registry', config: { default: 'standard' } },
      { id: 'preset-standard', name: '@deepseek-ai/dsh-agent-preset', config: { id: 'standard', plugins: [] } },
      { id: 'parent-preset', name: parent },
      { id: 'model-fixture', name: fileURLToPath(new URL('./fixtures/keyless-model.mjs', import.meta.url)), config: {
        project, protocolRegression: true, telemetryPath,
        byRole: { developer: ["printf '\\nNative learned instruction\\n' >> AGENTS.md"] },
      } },
    ] },
  ]))
  const { stdout } = await dsh('--profile', 'antfarm-test', '--patch', overlay,
    '--permission-mode', 'danger-full-access', '--json', 'Run the Antfarm protocol regression')
  const transcript = stdout.trim().split('\n').map(line => JSON.parse(line))
  const results = transcript.filter(event => event.type === 'tool_result')
  assert.equal(results.length, 2)
  assert.match(results[0].result, /\[failed\]/)
  assert.match(results[1].result, /\[completed\]/)

  const db = new DatabaseSync(join(env.DSH_HOME, 'antfarm/antfarm.db'), { readOnly: true })
  let attempts
  try {
    assert.equal(db.prepare('SELECT status FROM runs').get().status, 'completed')
    assert.equal(db.prepare("SELECT retry_count FROM steps WHERE step_id='plan'").get().retry_count, 1)
    assert.equal(db.prepare('SELECT retry_count FROM stories').get().retry_count, 1)
    attempts = db.prepare('SELECT session_id, state FROM dsh_attempts').all()
    assert.equal(attempts.length, 11)
    assert.equal(new Set(attempts.map(row => row.session_id)).size, 11)
    assert.equal(attempts.filter(row => row.state === 'failed').length, 2)
  } finally {
    db.close()
  }
  const sessions = join(env.DSH_HOME, 'sessions')
  const files = await readdir(sessions, { recursive: true })
  for (const attempt of attempts) {
    const generations = files.filter(file => basename(dirname(file)) === attempt.session_id && /session\.v\d+\.jsonl\.zstd$/.test(file))
      .sort((a, b) => Number(/session\.v(\d+)/.exec(a)[1]) - Number(/session\.v(\d+)/.exec(b)[1]))
    assert.ok(generations.length, `Missing persisted child Session ${attempt.session_id}`)
    const events = zstdDecompressSync(await readFile(join(sessions, generations.at(-1))))
      .toString().trim().split('\n').map(line => JSON.parse(line))
    const toolResults = events.filter(event => event.type === 'tool/result')
    assert.equal(toolResults.length, 1)
    assert.equal(toolResults[0].data.message.isError, false)
  }
  const requests = (await readFile(telemetryPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  const children = requests.filter(row => row.agent)
  assert.equal(children.some(row => row.missingContext), false)
  assert.equal(children.filter(row => row.action === 'bash').length, 11)
  const developers = children.filter(row => row.agent === 'developer' && row.action === 'bash')
  assert.equal(developers.length, 3)
  assert.equal(developers[0].learnedInstruction, false)
  assert.equal(developers[1].learnedInstruction, true)
  assert.equal(developers[2].learnedInstruction, true)
  assert.equal(children.filter(row => row.agent === 'reviewer' && row.action === 'finish').at(-1).recoveryGuidance, true)
  const summary = {
    run: 'completed', attempts: attempts.length, failedAttempts: 2, nativeBashCalls: 11,
    rootTools: transcript.filter(event => event.type === 'tool_call').map(event => event.tool),
    workerOrder: children.filter(row => row.action === 'finish').map(row => row.agent),
    learningRetained: true, recoveryGuidanceDelivered: true, missingContext: false,
  }
  const expected = JSON.parse(await readFile(new URL('./fixtures/native-protocol.expected.json', import.meta.url), 'utf8'))
  assert.deepEqual(summary, expected)
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
