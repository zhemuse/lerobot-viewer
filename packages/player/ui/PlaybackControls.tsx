import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { type ReactNode, useCallback } from 'react'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Slider } from '../components/ui/slider'
import { usePlayerActions } from '../hooks/usePlayerActions'
import { usePlayerState } from '../hooks/usePlayerState'

const RATE_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '1.5×', value: 1.5 },
  { label: '2×', value: 2 },
  { label: '3x', value: 3 },
  { label: '5x', value: 5 },
  { label: '10x', value: 10 },
]

function formatTime(frame: number, fps: number): string {
  if (fps <= 0) return '0:00.00'
  const s = frame / fps
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

interface PlaybackControlsProps {
  totalFrames: number
  fps: number
  strip?: ReactNode
}

export function PlaybackControls({ totalFrames, fps, strip }: PlaybackControlsProps) {
  const { currentFrame, isPlaying, rate } = usePlayerState()
  const { play, pause, seek, setRate } = usePlayerActions()

  const prevFrame = useCallback(() => seek(currentFrame - 1), [seek, currentFrame])
  const nextFrame = useCallback(() => seek(currentFrame + 1), [seek, currentFrame])

  const lastFrame = Math.max(totalFrames - 1, 0)

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{ background: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevFrame}>
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" className="h-8 w-8 rounded-full" onClick={isPlaying ? pause : play}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextFrame}>
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <span
          className="text-xs tabular-nums whitespace-nowrap shrink-0"
          style={{ color: 'var(--ink-muted)' }}
        >
          {currentFrame} / {lastFrame}
        </span>
        <span
          className="text-xs tabular-nums whitespace-nowrap shrink-0"
          style={{ color: 'var(--ink-muted)' }}
        >
          {formatTime(currentFrame, fps)} / {formatTime(lastFrame, fps)}
        </span>
        <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ink-muted)' }}>
          {fps} FPS
        </span>

        <div className="flex-1" />

        <Select value={String(rate)} onValueChange={(v) => setRate(Number(v))}>
          <SelectTrigger className="h-7 w-20 text-xs shrink-0">
            <SelectValue>
              {RATE_OPTIONS.find((o) => o.value === rate)?.label ?? `${rate}×`}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RATE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="px-4 py-3 cursor-pointer">
        <Slider
          value={[currentFrame]}
          min={0}
          max={Math.max(totalFrames - 1, 1)}
          step={1}
          onValueChange={(vals) => seek(Array.isArray(vals) ? (vals[0] ?? 0) : vals)}
        />
      </div>

      {strip && <div className="px-4 pb-3">{strip}</div>}
    </div>
  )
}
