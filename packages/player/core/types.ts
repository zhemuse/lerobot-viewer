export type FrameCallback = (frame: number, time: number) => void

export interface ClockState {
  currentFrame: number
  isPlaying: boolean
  rate: number
  totalFrames: number
  fps: number
}

export interface ClockOptions {
  totalFrames: number
  fps: number
  /** State-notification interval, in frames. Defaults to 3 (~20 Hz to React). */
  throttle?: number
}

/**
 * A single frame consumed by the UI panels. Callers convert their raw API
 * data into this shape before handing it to the SDK.
 */
export interface EpisodeFrame {
  frameIndex: number
  timestamp: number
  jointPositions: number[]
  actionPositions: number[]
}

/** URDF configuration consumed by `RobotViewerPanel`. */
export interface UrdfConfig {
  urdfUrl: string
  packages: Record<string, string>
  jointNames: string[]
}
