import { describe, expect, it, vi } from 'vitest'
import {
  combinedDisposable,
  Disposable,
  DisposableStore,
  NoopDisposable,
  toDisposable,
} from './lifecycle'

describe('toDisposable', () => {
  it('invokes the callback once even if disposed multiple times', () => {
    const cb = vi.fn()
    const d = toDisposable(cb)
    d.dispose()
    d.dispose()
    d.dispose()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('NoopDisposable', () => {
  it('is idempotent and shareable', () => {
    expect(() => {
      NoopDisposable.dispose()
      NoopDisposable.dispose()
    }).not.toThrow()
  })
})

describe('combinedDisposable', () => {
  it('disposes each member exactly once, in order', () => {
    const seen: number[] = []
    const combined = combinedDisposable(
      toDisposable(() => seen.push(1)),
      toDisposable(() => seen.push(2)),
      toDisposable(() => seen.push(3)),
    )
    combined.dispose()
    combined.dispose() // second call is a noop because toDisposable guards
    expect(seen).toEqual([1, 2, 3])
  })
})

describe('DisposableStore', () => {
  it('adds, delete-disposes, and clear-disposes items', () => {
    const store = new DisposableStore()
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()
    store.add(toDisposable(a))
    const bd = store.add(toDisposable(b))
    store.add(toDisposable(c))

    store.delete(bd)
    expect(b).toHaveBeenCalledTimes(1)

    store.clear()
    expect(a).toHaveBeenCalledTimes(1)
    expect(c).toHaveBeenCalledTimes(1)
    // Store is still usable after clear()
    expect(store.isDisposed).toBe(false)
  })

  it('throws when adding to a disposed store, and eagerly disposes the offender', () => {
    const store = new DisposableStore()
    store.dispose()
    const leak = vi.fn()
    expect(() => store.add(toDisposable(leak))).toThrow()
    expect(leak).toHaveBeenCalledTimes(1)
  })

  it('isolates a throwing disposable so the rest still clean up', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new DisposableStore()
    const after = vi.fn()
    store.add(
      toDisposable(() => {
        throw new Error('boom')
      }),
    )
    store.add(toDisposable(after))

    store.dispose()

    expect(after).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('refuses to add itself', () => {
    const store = new DisposableStore()
    expect(() => store.add(store)).toThrow()
  })
})

describe('Disposable', () => {
  it('disposes registered children automatically', () => {
    class MyService extends Disposable {
      readonly childA = this._register(toDisposable(this.onA))
      readonly childB = this._register(toDisposable(this.onB))
      constructor(
        private readonly onA: () => void,
        private readonly onB: () => void,
      ) {
        super()
      }
    }
    const a = vi.fn()
    const b = vi.fn()
    const svc = new MyService(a, b)
    svc.dispose()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
