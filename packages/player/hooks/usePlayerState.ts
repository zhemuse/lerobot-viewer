import type { ClockState } from '../core/types'
import { usePlayerContext } from './PlayerProvider'

/** Throttled state (updates every N frames) — drives progress bar, timecode, etc. */
export function usePlayerState(): ClockState {
  return usePlayerContext().state
}
