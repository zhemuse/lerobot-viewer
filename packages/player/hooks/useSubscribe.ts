import { useEffect, useRef } from 'react'
import type { FrameCallback } from '../core/types'
import { usePlayerContext } from './PlayerProvider'

/**
 * High-frequency subscription — fires on every rAF tick, causes zero React
 * re-renders. The callback is captured via a ref, so callers don't need to
 * memoize with `useCallback`.
 */
export function useSubscribe(cb: FrameCallback): void {
  const { clock } = usePlayerContext()
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    return clock.subscribe((frame, time) => cbRef.current(frame, time))
  }, [clock])
}
