import { useEffect, useRef } from 'react'
import { usePlayerContext } from './PlayerProvider'
import type { FrameCallback } from '../core/types'

/**
 * 高频订阅，RAF 每帧回调，零 re-render。
 * 内部用 ref 持有最新 cb，无需调用方 useCallback。
 */
export function useSubscribe(cb: FrameCallback): void {
  const { clock } = usePlayerContext()
  const cbRef = useRef(cb)
  cbRef.current = cb

  useEffect(() => {
    return clock.subscribe((frame, time) => cbRef.current(frame, time))
  }, [clock])
}
