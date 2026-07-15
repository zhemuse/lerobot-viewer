export interface DatasetMeta {
  fps: number
  totalEpisodes: number
  jointNames: string[]
  cameraNames: string[]
  episodes: EpisodeInfo[]
}

export interface EpisodeInfo {
  episodeIndex: number
  length: number
  task?: string
}

export interface EpisodeFrame {
  frameIndex: number
  timestamp: number
  jointPositions: number[]
  actionPositions: number[]
}
