import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { EpisodeFrame } from '../../core/types'
import type { URDFRobotHandle } from './URDFRobot'

interface UsePlaybackSyncOptions {
  frames: EpisodeFrame[]
  jointNames: string[]
  currentTimeRef: { current: number }
  robotRef: { current: URDFRobotHandle | null }
}

function findFrameByTime(frames: EpisodeFrame[], t: number): EpisodeFrame {
  if (t <= frames[0].timestamp) return frames[0]
  if (t >= frames[frames.length - 1].timestamp) return frames[frames.length - 1]
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].timestamp <= t) lo = mid
    else hi = mid - 1
  }
  return frames[lo]
}

export function usePlaybackSync({
  frames,
  jointNames,
  currentTimeRef,
  robotRef,
}: UsePlaybackSyncOptions) {
  const lastFrameIdxRef = useRef(-1)
  const anglesRef = useRef<Record<string, number>>({})

  useFrame(() => {
    if (!frames.length || !robotRef.current) return

    const frame = findFrameByTime(frames, currentTimeRef.current)
    if (frame.frameIndex === lastFrameIdxRef.current) return
    lastFrameIdxRef.current = frame.frameIndex

    const angles = anglesRef.current
    frame.jointPositions.forEach((val, i) => {
      if (i < jointNames.length) angles[jointNames[i]] = val
    })
    robotRef.current.setJointValues(angles)
  })
}
