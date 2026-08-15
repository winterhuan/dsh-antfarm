import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import React, { useEffect, useMemo, useState } from 'react'
import studioCss from './studio.css'

export const inject = ['slots', 'connection']

type Tab = 'runs' | 'workflow' | 'agents'
interface StoryRow { id: string; title: string; status: string; retryCount: number; feedback?: string }
interface RunRow {
  runId: string; workflowId: string; status: string; baseCwd?: string; workspace?: string; branch?: string; currentStep?: string; blockedReason?: string
  stories?: StoryRow[]; childSessionIds?: string[]
}
interface AgentRow { id: string; files: Record<string, string>; paths: Record<string, string> }
interface IndexData { runs: RunRow[]; workflows: string[]; editable: boolean }
interface WorkflowData { id: string; directory: string; yaml: string; agents: AgentRow[]; revision: string }

async function rpcCall<T>(connection: ConnectionHandle, endpoint: string, args: Record<string, unknown>): Promise<T> {
  const result = await connection.rpc.call('/api', endpoint, { args })
  if (!result.ok) throw new Error(result.error.message)
  return result.value as T
}

function RunList({ rows }: { rows: RunRow[] }): React.ReactElement {
  const groups = useMemo(() => {
    const result = new Map<string, RunRow[]>()
    for (const row of rows) {
      const key = row.baseCwd ?? 'Unknown repository'
      result.set(key, [...(result.get(key) ?? []), row])
    }
    return [...result]
  }, [rows])
  return React.createElement('div', { className: 'af-runs' }, ...groups.map(([repo, runs]) => React.createElement('section', { key: repo, className: 'af-group' },
    React.createElement('h3', null, repo),
    ...runs.map(run => React.createElement('details', { key: run.runId, className: 'af-run' },
      React.createElement('summary', null,
        React.createElement('span', { className: `af-status af-status-${run.status}` }, run.status),
        React.createElement('strong', null, run.runId),
        React.createElement('span', null, run.workflowId),
        run.currentStep === undefined ? null : React.createElement('span', null, `step: ${run.currentStep}`),
      ),
      React.createElement('dl', null,
        React.createElement('dt', null, 'Branch'), React.createElement('dd', null, run.branch ?? '-'),
        React.createElement('dt', null, 'Workspace'), React.createElement('dd', null, run.workspace ?? '-'),
        run.blockedReason === undefined ? null : React.createElement(React.Fragment, null, React.createElement('dt', null, 'Blocked'), React.createElement('dd', null, run.blockedReason)),
      ),
      ...(run.stories ?? []).map(story => React.createElement('div', { key: story.id, className: 'af-story' },
        React.createElement('span', { className: `af-status af-status-${story.status}` }, story.status),
        React.createElement('strong', null, story.title),
        React.createElement('span', null, `retries: ${story.retryCount}`),
        story.feedback === undefined ? null : React.createElement('p', null, story.feedback),
      )),
      (run.childSessionIds?.length ?? 0) === 0 ? null : React.createElement('div', { className: 'af-children' }, React.createElement('strong', null, 'Child sessions'), React.createElement('code', null, run.childSessionIds?.join('\n'))),
    )),
  )))
}

function Studio({ call }: { call: <T>(endpoint: string, args: Record<string, unknown>) => Promise<T> }): React.ReactElement {
  const [tab, setTab] = useState<Tab>('runs')
  const [index, setIndex] = useState<IndexData>({ runs: [], workflows: [], editable: false })
  const [workflowId, setWorkflowId] = useState('')
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [agentId, setAgentId] = useState('')
  const [agentFile, setAgentFile] = useState('IDENTITY.md')
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')

  const loadIndex = async (): Promise<void> => {
    try {
      const value = await call<IndexData>('antfarmStudio/index', {})
      setIndex(value)
      if (workflowId === '' && value.workflows[0] !== undefined) setWorkflowId(value.workflows[0])
      setMessage('')
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  const loadWorkflow = async (id = workflowId): Promise<void> => {
    if (id === '') return
    try {
      const value = await call<WorkflowData>('antfarmStudio/workflow', { workflowId: id })
      setWorkflow(value)
      const first = value.agents[0]?.id ?? ''
      setAgentId(first)
      setDraft(tab === 'agents' ? value.agents.find(agent => agent.id === first)?.files[agentFile] ?? '' : value.yaml)
      setMessage('')
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : String(error)) }
  }
  useEffect(() => { void loadIndex() }, [])
  useEffect(() => { if (tab !== 'runs') void loadWorkflow() }, [tab, workflowId])
  useEffect(() => {
    if (tab === 'runs' || workflow === null) return
    const timer = window.setInterval(() => {
      void call<WorkflowData>('antfarmStudio/workflow', { workflowId: workflow.id }).then(value => {
        if (value.revision !== workflow.revision) setMessage('Files changed on disk. Refresh to reload.')
      }).catch(error => { setMessage(error instanceof Error ? error.message : String(error)) })
    }, 3000)
    return () => { window.clearInterval(timer) }
  }, [tab, workflow, call])
  useEffect(() => {
    if (tab !== 'agents' || workflow === null) return
    setDraft(workflow.agents.find(agent => agent.id === agentId)?.files[agentFile] ?? '')
  }, [tab, workflow, agentId, agentFile])

  const save = async (): Promise<void> => {
    if (workflow === null) return
    const path = tab === 'workflow' ? 'workflow.yml' : workflow.agents.find(agent => agent.id === agentId)?.paths[agentFile]
    if (path === undefined) return
    try {
      await call<{ saved: boolean }>('antfarmStudio/save', { workflowId: workflow.id, path, content: draft })
      setMessage('Saved')
      await loadWorkflow(workflow.id)
    } catch (error: unknown) { setMessage(error instanceof Error ? error.message : String(error)) }
  }

  const controls = React.createElement('div', { className: 'af-toolbar' },
    React.createElement('div', { className: 'af-tabs', role: 'tablist' }, ...(['runs', 'workflow', 'agents'] as Tab[]).map(value => React.createElement('button', { key: value, type: 'button', role: 'tab', 'aria-selected': tab === value, onClick: () => setTab(value) }, value[0]?.toUpperCase() + value.slice(1)))),
    tab === 'runs' ? React.createElement('button', { type: 'button', onClick: () => { void loadIndex() } }, 'Refresh') : React.createElement(React.Fragment, null,
      React.createElement('select', { value: workflowId, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setWorkflowId(event.target.value), 'aria-label': 'Workflow' }, ...index.workflows.map(id => React.createElement('option', { key: id, value: id }, id))),
      React.createElement('button', { type: 'button', onClick: () => { void loadWorkflow() } }, 'Refresh'),
      React.createElement('button', { type: 'button', onClick: () => { void save() }, disabled: !index.editable || workflow === null || (tab === 'agents' && agentId === ''), title: index.editable ? 'Save workflow file' : 'Studio editing is disabled' }, index.editable ? 'Save' : 'Read only'),
    ),
  )

  let content: React.ReactElement
  if (tab === 'runs') content = React.createElement(RunList, { rows: index.runs })
  else if (tab === 'workflow') content = React.createElement('textarea', { className: 'af-editor', value: draft, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value), spellCheck: false, 'aria-label': 'Workflow YAML' })
  else content = React.createElement('div', { className: 'af-agents' },
    React.createElement('div', { className: 'af-agent-list' }, ...(workflow?.agents ?? []).map(agent => React.createElement('button', { key: agent.id, type: 'button', 'aria-pressed': agentId === agent.id, onClick: () => setAgentId(agent.id) }, agent.id))),
    React.createElement('div', { className: 'af-file-tabs' }, ...['IDENTITY.md', 'SOUL.md', 'AGENTS.md'].map(name => React.createElement('button', { key: name, type: 'button', 'aria-pressed': agentFile === name, onClick: () => setAgentFile(name) }, name.replace('.md', '')))),
    React.createElement('textarea', { className: 'af-editor', value: draft, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value), spellCheck: false, 'aria-label': 'Agent Markdown' }),
  )
  return React.createElement('div', { className: 'af-studio' }, controls, message === '' ? null : React.createElement('div', { className: 'af-message', role: 'status' }, message), content)
}

/** Register the Antfarm Studio settings section. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const call = <T,>(endpoint: string, args: Record<string, unknown>): Promise<T> => rpcCall<T>(connection, endpoint, args)
  const AntfarmStudio = (): React.ReactElement => React.createElement(Studio, { call })
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-antfarm'
    tag.textContent = studioCss
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'antfarm Studio styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'antfarm', order: 30, label: 'Antfarm' }, AntfarmStudio))
}
