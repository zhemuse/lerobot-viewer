/**
 * Lifecycle primitives — VSCode-style resource management.
 *
 * Every async subscription, DOM listener, timer, GPU handle, and IPC binding
 * should implement `IDisposable`. A `DisposableStore` groups them so a service
 * or panel can release everything atomically on teardown.
 */

export interface IDisposable {
  dispose(): void
}

export function toDisposable(fn: () => void): IDisposable {
  let disposed = false
  return {
    dispose(): void {
      if (disposed) return
      disposed = true
      fn()
    },
  }
}

export function combinedDisposable(...disposables: IDisposable[]): IDisposable {
  return toDisposable(() => {
    for (const d of disposables) d.dispose()
  })
}

export const NoopDisposable: IDisposable = Object.freeze({ dispose() {} })

/**
 * A collection of disposables that are released together. Any disposable added
 * after `dispose()` throws — a common source of leaks in long-lived apps.
 */
export class DisposableStore implements IDisposable {
  private readonly _store = new Set<IDisposable>()
  private _isDisposed = false

  get isDisposed(): boolean {
    return this._isDisposed
  }

  add<T extends IDisposable>(disposable: T): T {
    if (!disposable) return disposable
    if ((disposable as unknown) === this) {
      throw new Error('Cannot register a disposable on itself.')
    }
    if (this._isDisposed) {
      // Dispose immediately rather than leaking silently.
      disposable.dispose()
      throw new Error('Cannot add to a disposed store.')
    } else {
      this._store.add(disposable)
    }
    return disposable
  }

  delete(disposable: IDisposable): void {
    if (!disposable) return
    if (this._store.delete(disposable)) {
      disposable.dispose()
    }
  }

  /** Dispose all held items but keep the store usable. */
  clear(): void {
    if (this._store.size === 0) return
    try {
      for (const d of this._store) {
        try {
          d.dispose()
        } catch (err) {
          // Isolate: one failing disposable must not prevent the rest from cleaning up.
          console.error('[DisposableStore] disposable threw during clear():', err)
        }
      }
    } finally {
      this._store.clear()
    }
  }

  dispose(): void {
    if (this._isDisposed) return
    this._isDisposed = true
    this.clear()
  }
}

/**
 * Base class for anything that owns disposable resources. Subclasses call
 * `this._register(new X())` and get automatic cleanup on `.dispose()`.
 */
export abstract class Disposable implements IDisposable {
  protected readonly _store = new DisposableStore()

  protected _register<T extends IDisposable>(disposable: T): T {
    if ((disposable as unknown) === this) {
      throw new Error('Cannot register a disposable on itself.')
    }
    return this._store.add(disposable)
  }

  dispose(): void {
    this._store.dispose()
  }
}
