'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import type uPlot from 'uplot'
import { Button } from '../../components/ui/button'
import type { EpisodeFrame } from '../../core/types'
import { usePlayerActions } from '../../hooks/usePlayerActions'
import { useSubscribe } from '../../hooks/useSubscribe'
import { cn } from '../../lib/utils'
import { PanelShell } from '../PanelShell'
import { jointColor } from './colors'
import { downsampleColumnar } from './downsample'
import { JointSelector } from './JointSelector'
import { UPlotChart } from './UPlotChart'

const MAX_POINTS = 1500

export interface JointCurvesPanelProps {
  frames: EpisodeFrame[]
  jointNames: string[]
  fps: number
  totalFrames: number
  isLoading: boolean
}

export function JointCurvesPanel({
  frames,
  jointNames,
  fps,
  totalFrames,
  isLoading,
}: JointCurvesPanelProps) {
  const { seek } = usePlayerActions()
  const plotRef = useRef<uPlot | null>(null)
  const setPlayheadRef = useRef<((t: number) => void) | null>(null)

  const [visibleJoints, setVisibleJoints] = useState<number[]>(() => jointNames.map((_, i) => i))
  const [hasManualSelection, setHasManualSelection] = useState(false)
  const [showState, setShowState] = useState(true)
  const [showAction, setShowAction] = useState(true)

  const N = jointNames.length
  const effectiveVisibleJoints = useMemo(
    () => (hasManualSelection ? visibleJoints : jointNames.map((_, i) => i)),
    [hasManualSelection, visibleJoints, jointNames],
  )
  const visibleSet = useMemo(() => new Set(effectiveVisibleJoints), [effectiveVisibleJoints])

  const uplotData = useMemo((): uPlot.AlignedData => {
    if (!frames.length || !N) return [[]]
    const rawCols: number[][] = [
      frames.map((f) => f.frameIndex),
      ...jointNames.map((_, ji) => frames.map((f) => f.jointPositions?.[ji] ?? 0)),
      ...jointNames.map((_, ji) => frames.map((f) => f.actionPositions?.[ji] ?? 0)),
    ]
    return downsampleColumnar(rawCols, MAX_POINTS) as uPlot.AlignedData
  }, [frames, jointNames, N])

  const series = useMemo((): uPlot.Series[] => {
    const result: uPlot.Series[] = []
    jointNames.forEach((name, ji) => {
      result.push({
        label: name,
        stroke: jointColor(ji),
        width: 1.5,
        alpha: 0.85,
        show: showState && visibleSet.has(ji),
      })
    })
    jointNames.forEach((name, ji) => {
      result.push({
        label: `${name} (action)`,
        stroke: jointColor(ji),
        width: 1.2,
        dash: [4, 3],
        alpha: 0.55,
        show: showAction && visibleSet.has(ji),
      })
    })
    return result
  }, [jointNames, visibleSet, showState, showAction])

  const { tMin, tMax } = useMemo(() => {
    if (!frames.length) return { tMin: 0, tMax: 0 }
    return { tMin: frames[0].frameIndex, tMax: frames[frames.length - 1].frameIndex }
  }, [frames])

  useSubscribe((frame) => {
    const setPlayhead = setPlayheadRef.current
    if (!setPlayhead) return
    const tPlay = totalFrames > 1 ? tMin + (frame / (totalFrames - 1)) * (tMax - tMin) : tMin
    setPlayhead(tPlay)
  })

  const handlePlotReady = useCallback((plot: uPlot, setPlayhead: (t: number) => void) => {
    plotRef.current = plot
    setPlayheadRef.current = setPlayhead
  }, [])

  const handleSeek = useCallback(
    (frameIndex: number) => {
      if (totalFrames < 2 || tMax === tMin) return
      const frame = Math.round(((frameIndex - tMin) / (tMax - tMin)) * (totalFrames - 1))
      seek(Math.max(0, Math.min(frame, totalFrames - 1)))
    },
    [seek, tMin, tMax, totalFrames],
  )

  const toggleJoint = (ji: number, checked: boolean) => {
    setHasManualSelection(true)
    setVisibleJoints((prev) => {
      if (checked) return prev.includes(ji) ? prev : [...prev, ji]
      return prev.filter((j) => j !== ji)
    })
  }

  return (
    <PanelShell
      title={
        <JointSelector
          jointNames={jointNames}
          visibleJoints={effectiveVisibleJoints}
          onToggle={toggleJoint}
          onToggleAll={(all) => {
            setHasManualSelection(true)
            setVisibleJoints(all ? jointNames.map((_, i) => i) : [])
          }}
        />
      }
      loading={isLoading}
      className="h-full"
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="flex justify-end gap-1 px-2 pt-1 shrink-0">
          <Button
            variant="outline"
            size="xs"
            aria-pressed={showState}
            className={cn(!showState && 'opacity-40')}
            onClick={() => setShowState((v) => !v)}
          >
            <span className="inline-block w-3 h-px bg-current" />
            State
          </Button>
          <Button
            variant="outline"
            size="xs"
            aria-pressed={showAction}
            className={cn(!showAction && 'opacity-40')}
            onClick={() => setShowAction((v) => !v)}
          >
            <span className="inline-block w-3 border-t border-dashed border-current" />
            Action
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          {frames.length > 0 && N > 0 && (
            <UPlotChart
              data={uplotData}
              series={series}
              fps={fps}
              jointNames={jointNames}
              visibleJoints={effectiveVisibleJoints}
              showState={showState}
              showAction={showAction}
              onPlotReady={handlePlotReady}
              onSeek={handleSeek}
            />
          )}
        </div>
      </div>
    </PanelShell>
  )
}
