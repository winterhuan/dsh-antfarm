/** Webhook requests are isolated from workflow acceptance and drained by disposal. */
import { createServer } from 'node:http'
import { expect, it, onTestFinished } from 'vitest'
import { WorkflowNotifications } from '../src/runtime/notifications.ts'

it('sends original event fields with deployment authentication', async () => {
  let received!: (value: { authorization: string | undefined; body: string }) => void
  const request = new Promise<{ authorization: string | undefined; body: string }>((resolve) => {
    received = resolve
  })
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      received({ authorization: req.headers.authorization, body })
      res.writeHead(204).end()
    })
  })
  onTestFinished(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing server address')
  const notices = new WorkflowNotifications(10000, 'fixture-token')
  onTestFinished(() => notices.dispose())
  const event = { ts: '2026-11-08T00:00:00Z', event: 'run.completed', runId: 'fixture-run' }
  notices.send(event, `http://127.0.0.1:${address.port}/events`)
  const value = await request
  expect(value.authorization).toBe('fixture-token')
  expect(JSON.parse(value.body)).toEqual(event)
})

it('aborts an outstanding webhook before disposing its request callbacks', async () => {
  let received!: () => void
  const request = new Promise<void>((resolve) => {
    received = resolve
  })
  const server = createServer((req) => {
    req.resume()
    received()
  })
  onTestFinished(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing server address')
  const notices = new WorkflowNotifications(10000)
  onTestFinished(() => notices.dispose())
  notices.send({ ts: '', event: 'step.running', runId: 'fixture' }, `http://127.0.0.1:${address.port}/events`)
  await request
  await notices.dispose()
})
