import { useCallback } from 'react'
import { usePlayerContext } from './PlayerProvider'

/** Stable-identity actions — safe to pass to `onClick` or list in `useEffect` deps. */
export function usePlayerActions() {
  const { clock } = usePlayerContext()
  const play = useCallback(() => clock.play(), [clock])
  const pause = useCallback(() => clock.pause(), [clock])
  const seek = useCallback((frame: number) => clock.seek(frame), [clock])
  const setRate = useCallback((rate: number) => clock.setRate(rate), [clock])
  return { play, pause, seek, setRate }
}
