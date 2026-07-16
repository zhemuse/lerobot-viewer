import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parquetReadObjects } from 'hyparquet'

import type { DatasetMeta, EpisodeFrame, EpisodeInfo } from '../types'
import { DatasetSource } from './DatasetSource'

const IMAGES_PREFIX = 'observation.images.'
const OBS_PREFIX = 'observation.'
const FLOAT_DTYPES = new Set(['float32', 'float64'])

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

function padEpisode(index: number): string {
  return String(index).padStart(6, '0')
}

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
      (k) =>
        k.startsWith(OBS_PREFIX) && !k.startsWith(IMAGES_PREFIX) && isLabeledVector(features[k]),
    ) ?? null
  )
}

function toNumberArray(val: unknown): number[] {
  if (Array.isArray(val)) return val as number[]
  if (val instanceof Float32Array || val instanceof Float64Array) return Array.from(val)
  return []
}

function isVector(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 1
  if (val instanceof Float32Array || val instanceof Float64Array) return val.length > 1
  return false
}

function detectStateKey(row: Record<string, unknown>): string | null {
  return (
    Object.keys(row).find(
      (k) => k.startsWith(OBS_PREFIX) && !k.startsWith(IMAGES_PREFIX) && isVector(row[k]),
    ) ?? null
  )
}

function detectActionKey(row: Record<string, unknown>): string | null {
  return Object.keys(row).find((k) => !k.startsWith(OBS_PREFIX) && isVector(row[k])) ?? null
}

/**
 * Reads a LeRobot dataset from a local directory using hyparquet.
 *
 * Directory layout (Hugging Face LeRobot convention):
 *
 *   root/
 *     meta/info.json
 *     meta/episodes.jsonl
 *     data/chunk-XXX/episode_NNNNNN.parquet
 *     videos/chunk-XXX/observation.images.<cam>/episode_NNNNNN.mp4
 */
export class LocalDatasetSource extends DatasetSource {
  readonly id: string

  constructor(private readonly rootPath: string) {
    super()
    this.id = `local:${rootPath}`
  }

  async meta(signal?: AbortSignal): Promise<DatasetMeta> {
    signal?.throwIfAborted?.()

    const infoPath = join(this.rootPath, 'meta', 'info.json')
    const info: LeRobotInfo = JSON.parse(readFileSync(infoPath, 'utf-8'))

    const stateKey = findStateFeatureKey(info.features)
    const jointNames: string[] = stateKey ? (info.features[stateKey].names ?? []) : []

    const cameraNames: string[] = Object.entries(info.features)
      .filter(([, f]) => f.dtype === 'video')
      .map(([k]) => (k.startsWith(IMAGES_PREFIX) ? k.slice(IMAGES_PREFIX.length) : k))

    const episodesPath = join(this.rootPath, 'meta', 'episodes.jsonl')
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

    signal?.throwIfAborted?.()

    return {
      fps: info.fps,
      totalEpisodes: info.total_episodes,
      jointNames,
      cameraNames,
      episodes,
    }
  }

  async frames(episodeIndex: number, signal?: AbortSignal): Promise<EpisodeFrame[]> {
    signal?.throwIfAborted?.()

    const filePath = this._findParquetFile(episodeIndex)
    const buffer = readFileSync(filePath)
    signal?.throwIfAborted?.()

    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer

    const rows = await parquetReadObjects({ file: arrayBuffer })
    signal?.throwIfAborted?.()

    if (rows.length === 0) return []

    const stateKey = detectStateKey(rows[0])
    const actionKey = detectActionKey(rows[0])

    return rows.map((row, frameIndex) => ({
      frameIndex,
      timestamp: typeof row.timestamp === 'number' ? row.timestamp : frameIndex / 30,
      jointPositions: stateKey ? toNumberArray(row[stateKey]) : [],
      actionPositions: actionKey ? toNumberArray(row[actionKey]) : [],
    }))
  }

  videoUrl(episodeIndex: number, camera: string): string {
    // Consumed by the Electron custom protocol handler; scheme+host must match
    // `apps/lerobot-viewer/src/main/protocol.ts`.
    return `lerobot://videos/observation.images.${camera}/episode_${padEpisode(episodeIndex)}.mp4`
  }

  private _findParquetFile(episodeIndex: number): string {
    const dataDir = join(this.rootPath, 'data')
    const chunks = readdirSync(dataDir)
      .filter((d) => d.startsWith('chunk-'))
      .sort()
    const filename = `episode_${padEpisode(episodeIndex)}.parquet`
    for (const chunk of chunks) {
      const candidate = join(dataDir, chunk, filename)
      if (existsSync(candidate)) return candidate
    }
    throw new Error(`Parquet file not found for episode ${episodeIndex} in ${dataDir}`)
  }
}
