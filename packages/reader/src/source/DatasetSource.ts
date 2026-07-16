import type { DatasetMeta, EpisodeFrame } from '../types'

/**
 * Abstract dataset source.
 *
 * Different backends (local filesystem, HuggingFace Hub, HTTP mirror) implement
 * this interface. Consumers hold a `DatasetSource` instance and don't care
 * where the bytes come from.
 *
 * All async methods accept an optional `AbortSignal` so callers can cancel
 * in-flight work when the user switches datasets / episodes.
 */
export abstract class DatasetSource {
  /** Stable id for logging and cache keys. Subclasses override. */
  abstract readonly id: string

  /** Load the dataset-level metadata (episodes, fps, joint names, cameras). */
  abstract meta(signal?: AbortSignal): Promise<DatasetMeta>

  /** Load every frame of a single episode. */
  abstract frames(episodeIndex: number, signal?: AbortSignal): Promise<EpisodeFrame[]>

  /**
   * Return a URL that the app can hand to a `<video>` element to stream a
   * single camera's video for a single episode. Scheme is source-specific
   * (`lerobot://` for local, `https://` for hub/http).
   */
  abstract videoUrl(episodeIndex: number, camera: string): string
}
