import { usePlayerContext } from './PlayerProvider'
import type { ClockState } from '../core/types'

/** 低频（每 throttle 帧更新一次），用于进度条、时间码等 UI */
export function usePlayerState(): ClockState {
  return usePlayerContext().state
}
