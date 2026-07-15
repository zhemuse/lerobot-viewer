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
  /** 低频通知间隔（帧数），默认 3（约 20fps 通知 React） */
  throttle?: number
}

/** 单帧数据，由 UI 面板消费。Feature 层负责把 API 数据转换为此形状。 */
export interface EpisodeFrame {
  frameIndex: number
  timestamp: number
  jointPositions: number[]
  actionPositions: number[]
}

/** URDF 配置，由 RobotViewerPanel 消费 */
export interface UrdfConfig {
  urdfUrl: string
  packages: Record<string, string>
  jointNames: string[]
}

