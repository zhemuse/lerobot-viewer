import { useCallback, useEffect, useRef } from 'react'
import { usePlayerContext } from './PlayerProvider'

/**
 * 多路 <video> 注册制，内部订阅时钟做漂移纠偏。
 * registerVideo 传 null 时自动注销。
 */
export function useVideoChannel(fps: number): {
  registerVideo: (key: string, el: HTMLVideoElement | null) => void
} {
  const { clock } = usePlayerContext()
  const videoMapRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const fpsRef = useRef(fps)
  fpsRef.current = fps

  // 播放/暂停 & 倍速同步
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

  // 高频漂移纠偏
  useEffect(() => {
    return clock.subscribe((_frame, time) => {
      const threshold = 2 / fpsRef.current
      videoMapRef.current.forEach((video) => {
        if (Math.abs(video.currentTime - time) > threshold) {
          video.currentTime = time
        }
      })
    })
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
