import { readFileSync } from 'fs'
import { join } from 'path'
import type { DatasetMeta, EpisodeInfo } from './types'

interface FeatureDef {
  dtype: string
  shape: number[]
  names?: string[] | null
}

interface LeRobotInfo {
  fps: number
  total_episodes: number
  features: Record<string, FeatureDef>
}

const FLOAT_DTYPES = new Set(['float32', 'float64'])
const IMAGES_PREFIX = 'observation.images.'
const OBS_PREFIX = 'observation.'

function isLabeledVector(f: FeatureDef): boolean {
  return (
    FLOAT_DTYPES.has(f.dtype) &&
    f.shape.length === 1 &&
    f.shape[0] > 1 &&
    Array.isArray(f.names) &&
    f.names.length > 0
  )
}

function findStateFeatureKey(features: Record<string, FeatureDef>): string | null {
  return (
    Object.keys(features).find(
      (k) => k.startsWith(OBS_PREFIX) && !k.startsWith(IMAGES_PREFIX) && isLabeledVector(features[k])
    ) ?? null
  )
}

export async function readDatasetMeta(dirPath: string): Promise<DatasetMeta> {
  const infoPath = join(dirPath, 'meta', 'info.json')
  const info: LeRobotInfo = JSON.parse(readFileSync(infoPath, 'utf-8'))

  const stateKey = findStateFeatureKey(info.features)
  const jointNames: string[] = stateKey ? info.features[stateKey].names ?? [] : []

  const cameraNames: string[] = Object.entries(info.features)
    .filter(([, f]) => f.dtype === 'video')
    .map(([k]) => (k.startsWith(IMAGES_PREFIX) ? k.slice(IMAGES_PREFIX.length) : k))

  const episodesPath = join(dirPath, 'meta', 'episodes.jsonl')
  const episodes: EpisodeInfo[] = readFileSync(episodesPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const obj = JSON.parse(line)
      return {
        episodeIndex: obj.episode_index as number,
        length: obj.length as number,
        task: (obj.task as string | undefined) ?? undefined,
      }
    })

  return {
    fps: info.fps,
    totalEpisodes: info.total_episodes,
    jointNames,
    cameraNames,
    episodes,
  }
}
