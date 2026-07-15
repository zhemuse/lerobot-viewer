import type { ClockOptions, ClockState, FrameCallback } from './types'

export class PlaybackClock {
  private _totalFrames: number
  private _fps: number
  private _throttle: number

  private _currentTime = 0
  private _isPlaying = false
  private _rate = 1

  private _rafId = 0
  private _lastTimestamp: number | null = null
  private _framesSinceNotify = 0

  private _subscribers = new Set<FrameCallback>()
  private _stateListeners = new Set<(s: ClockState) => void>()

  /** 供 R3F useFrame 和 chart playhead 直读，无需订阅 */
  readonly currentTimeRef: { current: number } = { current: 0 }

  constructor({ totalFrames, fps, throttle = 3 }: ClockOptions) {
    this._totalFrames = totalFrames
    this._fps = fps
    this._throttle = throttle
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVisibilityChange)
    }
  }

  private _onVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && !document.hidden) {
      // Tab became visible — discard accumulated hidden time to prevent clock jump
      this._lastTimestamp = null
    }
  }

  private get _totalDuration() {
    return this._totalFrames / this._fps
  }

  private _frameAt(time: number): number {
    return Math.min(Math.floor(time * this._fps), this._totalFrames - 1)
  }

  get state(): ClockState {
    return {
      currentFrame: this._frameAt(this._currentTime),
      isPlaying: this._isPlaying,
      rate: this._rate,
      totalFrames: this._totalFrames,
      fps: this._fps,
    }
  }

  private _notifySubscribers(): void {
    const frame = this._frameAt(this._currentTime)
    this.currentTimeRef.current = this._currentTime
    this._subscribers.forEach((cb) => {
      try {
        cb(frame, this._currentTime)
      } catch {
        // Isolate subscriber failures so one panel cannot break playback.
      }
    })
  }

  private _notifyStateListeners(): void {
    const s = this.state
    this._stateListeners.forEach((cb) => {
      try {
        cb(s)
      } catch {
        // Isolate listener failures.
      }
    })
  }

  private _tick = (timestamp: number): void => {
    if (this._isPlaying) {
      if (this._lastTimestamp !== null) {
        const delta = (timestamp - this._lastTimestamp) / 1000
        this._currentTime = Math.min(
          this._currentTime + delta * this._rate,
          this._totalDuration,
        )

        if (this._currentTime >= this._totalDuration) {
          this._currentTime = this._totalDuration
          this._isPlaying = false
          this._lastTimestamp = null
          this._notifySubscribers()
          this._notifyStateListeners()
          return
        }
      }
      this._lastTimestamp = timestamp
    }

    this._notifySubscribers()

    this._framesSinceNotify++
    if (this._framesSinceNotify >= this._throttle) {
      this._framesSinceNotify = 0
      this._notifyStateListeners()
    }

    if (this._isPlaying) {
      if (typeof requestAnimationFrame !== 'undefined') {
        this._rafId = requestAnimationFrame(this._tick)
      }
    }
  }

  play(): void {
    if (this._isPlaying) return
    if (this._currentTime >= this._totalDuration) {
      this._currentTime = 0
    }
    this._lastTimestamp = null
    this._isPlaying = true
    this._notifyStateListeners()
    if (typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(this._tick)
    }
  }

  pause(): void {
    this._isPlaying = false
    this._lastTimestamp = null
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId)
    }
    this._notifyStateListeners()
  }

  seek(frame: number): void {
    const clamped = Math.max(0, Math.min(frame, this._totalFrames - 1))
    this._currentTime = clamped / this._fps
    this._notifySubscribers()
    this._notifyStateListeners()
  }

  setRate(rate: number): void {
    this._rate = rate
    this._notifyStateListeners()
  }

  subscribe(cb: FrameCallback): () => void {
    this._subscribers.add(cb)
    return () => this._subscribers.delete(cb)
  }

  onStateChange(cb: (s: ClockState) => void): () => void {
    this._stateListeners.add(cb)
    return () => this._stateListeners.delete(cb)
  }

  destroy(): void {
    this._isPlaying = false
    this._lastTimestamp = null
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId)
    }
    this._subscribers.clear()
    this._stateListeners.clear()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange)
    }
  }
}
