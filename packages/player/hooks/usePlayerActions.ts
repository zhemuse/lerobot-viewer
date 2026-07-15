import { useCallback } from 'react'
import { usePlayerContext } from './PlayerProvider'

/** Stable ref，可安全放入 onClick / useEffect 依赖，不触发 re-render */
export function usePlayerActions() {
  const { clock } = usePlayerContext()
  const play = useCallback(() => clock.play(), [clock])
  const pause = useCallback(() => clock.pause(), [clock])
  const seek = useCallback((frame: number) => clock.seek(frame), [clock])
  const setRate = useCallback((rate: number) => clock.setRate(rate), [clock])
  return { play, pause, seek, setRate }
}
