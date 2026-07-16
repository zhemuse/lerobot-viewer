import { useCallback, useEffect, useRef } from 'react'
import { usePlayerContext } from './PlayerProvider'

/** Drift correction rate. 10Hz is plenty — a 100 ms lag is imperceptible on 30–60 fps footage. */
const DRIFT_CHECK_INTERVAL_MS = 100

/**
 * Multi-`<video>` registration hub. Subscribes to the clock and keeps every
 * registered element in sync (play/pause, playbackRate, and periodic drift
 * correction). Pass `null` to `registerVideo(key, null)` to unregister.
 */
export function useVideoChannel(fps: number): {
  registerVideo: (key: string, el: HTMLVideoElement | null) => void
} {
  const { clock } = usePlayerContext()
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const fpsRef = useRef(fps)
  fpsRef.current = fps

  // Play/pause & rate sync — piggybacks on the low-frequency state channel.
  useEffect(() => {
    let prevIsPlaying = clock.state.isPlaying
    let prevRate = clock.state.rate
    return clock.onStateChange((state) => {
      const isPlayingChanged = state.isPlaying !== prevIsPlaying
      const rateChanged = state.rate !== prevRate
      prevIsPlaying = state.isPlaying
      prevRate = state.rate
      if (!isPlayingChanged && !rateChanged) return
      videoMapRef.current.forEach((video) => {
        if (rateChanged) {
          video.playbackRate = state.rate
        }
        if (isPlayingChanged) {
          if (state.isPlaying) {
            video.play().catch(() => {})
          } else {
            video.pause()
          }
        }
      })
    })
  }, [clock])

  // Drift correction. Previously ran on `clock.subscribe` which fires every rAF
  // (~60Hz). That meant `Math.abs(video.currentTime - time)` ran on every video
  // element every frame — expensive at 4+ cameras. Now we tick at 10Hz via a
  // setInterval; only runs while playing. A 100 ms slip is not perceptible.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    const check = () => {
      const time = clock.currentTimeRef.current
      const threshold = 2 / fpsRef.current
      videoMapRef.current.forEach((video) => {
        if (Math.abs(video.currentTime - time) > threshold) {
          video.currentTime = time
        }
      })
    }

    const start = () => {
      if (intervalId !== null) return
      intervalId = setInterval(check, DRIFT_CHECK_INTERVAL_MS)
    }
    const stop = () => {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    }

    if (clock.state.isPlaying) start()

    const unsubscribe = clock.onStateChange((s) => {
      if (s.isPlaying) start()
      else {
        stop()
        // Snap once on pause so scrubbing while paused is exact.
        check()
      }
    })

    return () => {
      stop()
      unsubscribe()
    }
  }, [clock])

  const registerVideo = useCallback(
    (key: string, el: HTMLVideoElement | null) => {
      if (el) {
        el.playbackRate = clock.state.rate
        videoMapRef.current.set(key, el)
      } else {
        videoMapRef.current.delete(key)
      }
    },
    [clock],
  )

  return { registerVideo }
}
