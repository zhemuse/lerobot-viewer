import { contextBridge, ipcRenderer } from 'electron'
import type { DatasetMeta, EpisodeFrame } from '@lerobot/lerobot-reader'
import type { RecentEntry } from '../main/recent'

const lerobot = {
  openDataset: (): Promise<{ path: string; meta: DatasetMeta } | null> =>
    ipcRenderer.invoke('open-dataset'),

  loadEpisode: (episodeIndex: number): Promise<EpisodeFrame[]> =>
    ipcRenderer.invoke('load-episode', episodeIndex),

  resolveVideoUrl: (relativePath: string): string =>
    `lerobot://videos/${relativePath}`,

  openUrdf: (): Promise<string | null> =>
    ipcRenderer.invoke('open-urdf'),

  listRecent: (): Promise<RecentEntry[]> =>
    ipcRenderer.invoke('list-recent'),

  openRecent: (path: string): Promise<{ path: string; meta: DatasetMeta } | null> =>
    ipcRenderer.invoke('open-recent', path),

  clearRecent: (): Promise<void> =>
    ipcRenderer.invoke('clear-recent'),
}

contextBridge.exposeInMainWorld('lerobot', lerobot)

export type LerobotBridge = typeof lerobot
export type { RecentEntry } from '../main/recent'
