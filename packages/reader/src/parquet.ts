import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parquetReadObjects } from 'hyparquet'
import type { EpisodeFrame } from './types'

const IMAGES_PREFIX = 'observation.images.'
const OBS_PREFIX = 'observation.'

function padEpisode(index: number): string {
  return String(index).padStart(6, '0')
}

function findParquetFile(dirPath: string, episodeIndex: number): string {
  const dataDir = join(dirPath, 'data')
  const chunks = readdirSync(dataDir)
    .filter((d) => d.startsWith('chunk-'))
    .sort()
  const filename = `episode_${padEpisode(episodeIndex)}.parquet`
  for (const chunk of chunks) {
    const candidate = join(dataDir, chunk, filename)
    try {
      readFileSync(candidate)
      return candidate
    } catch {
      // try next chunk
    }
  }
  throw new Error(`Parquet file not found for episode ${episodeIndex} in ${dataDir}`)
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
      (k) => k.startsWith(OBS_PREFIX) && !k.startsWith(IMAGES_PREFIX) && isVector(row[k])
    ) ?? null
  )
}

function detectActionKey(row: Record<string, unknown>): string | null {
  return Object.keys(row).find((k) => !k.startsWith(OBS_PREFIX) && isVector(row[k])) ?? null
}

export async function readEpisodeFrames(
  dirPath: string,
  episodeIndex: number
): Promise<EpisodeFrame[]> {
  const filePath = findParquetFile(dirPath, episodeIndex)
  const buffer = readFileSync(filePath)
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer

  const rows = await parquetReadObjects({ file: arrayBuffer })
  if (rows.length === 0) return []

  const stateKey = detectStateKey(rows[0])
  const actionKey = detectActionKey(rows[0])

  return rows.map((row, frameIndex) => ({
    frameIndex,
    timestamp: typeof row['timestamp'] === 'number' ? row['timestamp'] : frameIndex / 30,
    jointPositions: stateKey ? toNumberArray(row[stateKey]) : [],
    actionPositions: actionKey ? toNumberArray(row[actionKey]) : [],
  }))
}
