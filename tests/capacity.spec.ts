import { describe, expect, it } from 'vitest'
import { RunCapacity } from '../src/runtime/capacity.ts'

describe('fair execution capacity', () => {
  it('alternates eligible owners and retains FIFO within each owner', async () => {
    const capacity = new RunCapacity(1, 1)
    const signal = new AbortController().signal
    const release = await capacity.acquire('a', signal)
    const order: string[] = []
    const second = capacity.acquire('a', signal).then(unlock => { order.push('a'); return unlock })
    const third = capacity.acquire('b', signal).then(unlock => { order.push('b'); return unlock })
    release(); const unlockB = await third
    expect(order).toEqual(['b'])
    unlockB(); const unlockA = await second
    expect(order).toEqual(['b', 'a']); unlockA(); unlockA()
    const final = await capacity.acquire('c', signal); final()
  })

  it('removes a cancelled queued request without consuming a slot', async () => {
    const capacity = new RunCapacity(1, 1)
    const release = await capacity.acquire('a', new AbortController().signal)
    const cancel = new AbortController()
    const waiting = capacity.acquire('b', cancel.signal)
    const rejected = expect(waiting).rejects.toThrow('cancelled')
    cancel.abort(new Error('cancelled')); await rejected
    release()
    const final = await capacity.acquire('c', new AbortController().signal); final()
  })
})
