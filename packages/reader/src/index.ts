// New OOP API — prefer this for new call sites.
export { DatasetSource } from './source/DatasetSource'
export { LocalDatasetSource } from './source/LocalDatasetSource'

// Shared types.
export type { DatasetMeta, EpisodeFrame, EpisodeInfo } from './types'

// -----------------------------------------------------------------------------
// Back-compat shims: `readDatasetMeta` and `readEpisodeFrames` are the original
// functional API. They now delegate to LocalDatasetSource. Kept so the Electron
// main process (apps/lerobot-viewer/src/main/ipc.ts) doesn't have to migrate in
// the same PR that introduces the abstraction.
// -----------------------------------------------------------------------------

import { LocalDatasetSource } from './source/LocalDatasetSource'
import type { DatasetMeta, EpisodeFrame } from './types'

export function readDatasetMeta(dirPath: string, signal?: AbortSignal): Promise<DatasetMeta> {
  return new LocalDatasetSource(dirPath).meta(signal)
}

export function readEpisodeFrames(
  dirPath: string,
  episodeIndex: number,
  signal?: AbortSignal,
): Promise<EpisodeFrame[]> {
  return new LocalDatasetSource(dirPath).frames(episodeIndex, signal)
}
