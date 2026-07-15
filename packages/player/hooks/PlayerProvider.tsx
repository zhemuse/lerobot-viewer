'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PlaybackClock } from '../core/PlaybackClock'
import type { ClockState } from '../core/types'

interface PlayerContextValue {
  clock: PlaybackClock
  state: ClockState
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({
  clock,
  children,
}: {
  clock: PlaybackClock
  children: ReactNode
}) {
  const [state, setState] = useState<ClockState>(() => clock.state)

  useEffect(() => {
    setState(clock.state)
    return clock.onStateChange(setState)
  }, [clock])

  return (
    <PlayerContext.Provider value={{ clock, state }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayerContext must be used inside <PlayerProvider>')
  return ctx
}
