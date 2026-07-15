import { useCallback, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { usePlayerState, usePlayerActions } from '@lerobot/player'

const RATE_OPTIONS = [0.5, 1, 2, 4]

function formatTime(frame: number, fps: number): string {
  if (fps <= 0) return '0:00.00'
  const s = frame / fps
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

interface Props {
  totalFrames: number
  fps: number
}

export function LocalPlaybackBar({ totalFrames, fps }: Props) {
  const { currentFrame, isPlaying, rate } = usePlayerState()
  const { play, pause, seek, setRate } = usePlayerActions()
  const trackRef = useRef<HTMLDivElement>(null)

  const lastFrame = Math.max(totalFrames - 1, 0)
  const progress = lastFrame > 0 ? currentFrame / lastFrame : 0

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      seek(Math.round(ratio * lastFrame))
    },
    [lastFrame, seek],
  )

  const onTrackMouseDown = (e: React.MouseEvent) => {
    seekFromEvent(e.clientX)
    const onMove = (ev: MouseEvent) => seekFromEvent(ev.clientX)
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const iconBtn =
    'w-8 h-8 flex items-center justify-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-hover)] transition-colors'

  return (
    <div className="h-11 shrink-0 border-t border-[var(--border)] bg-[var(--bg-panel-header)] flex items-center gap-4 px-3">
      {/* transport */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => seek(currentFrame - 1)}
          className={iconBtn}
          title="上一帧 (←)"
        >
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={() => (isPlaying ? pause() : play())}
          className={iconBtn}
          title={isPlaying ? '暂停 (Space)' : '播放 (Space)'}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button
          type="button"
          onClick={() => seek(currentFrame + 1)}
          className={iconBtn}
          title="下一帧 (→)"
        >
          <SkipForward size={14} />
        </button>
      </div>

      {/* time */}
      <div className="font-mono text-[12px] shrink-0 whitespace-nowrap">
        <span className="text-[var(--ink)]">{formatTime(currentFrame, fps)}</span>
        <span className="text-[var(--ink-muted)]"> / {formatTime(lastFrame, fps)}</span>
      </div>

      {/* scrubber */}
      <div
        ref={trackRef}
        onMouseDown={onTrackMouseDown}
        className="group flex-1 h-6 flex items-center cursor-pointer"
      >
        <div className="relative w-full h-0.5 group-hover:h-1 bg-[var(--bg-active)] rounded-full transition-all">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--accent)] rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[var(--accent)] shadow"
            style={{ left: `calc(${progress * 100}% - 5px)` }}
          />
        </div>
      </div>

      {/* rate */}
      <select
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        className="h-7 bg-[var(--bg-panel)] border border-[var(--border)] rounded-md text-[12px] text-[var(--ink)] px-2 shrink-0 hover:border-[var(--border-hover)] transition-colors"
      >
        {RATE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>

      {/* fps */}
      <span className="font-mono text-[12px] text-[var(--ink-muted)] shrink-0">
        {fps}fps
      </span>
    </div>
  )
}
