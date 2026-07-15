import { useState, useCallback } from 'react'
import type { DatasetMeta, EpisodeFrame } from '@lerobot/lerobot-reader'

interface DatasetState {
  meta: DatasetMeta | null
  datasetPath: string | null
  frames: EpisodeFrame[]
  selectedEpisode: number | null
  urdfUrl: string | null
  loading: boolean
}

export function useDataset() {
  const [state, setState] = useState<DatasetState>({
    meta: null,
    datasetPath: null,
    frames: [],
    selectedEpisode: null,
    urdfUrl: localStorage.getItem('lerobot:urdf'),
    loading: false,
  })

  const selectEpisode = useCallback(async (episodeIndex: number) => {
    setState((s) => ({ ...s, loading: true, selectedEpisode: episodeIndex, frames: [] }))
    try {
      const frames = await window.lerobot.loadEpisode(episodeIndex)
      setState((s) => ({ ...s, frames, loading: false }))
    } catch (e) {
      console.error(e)
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  const openDataset = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const r = await window.lerobot.openDataset()
      if (!r) {
        setState((s) => ({ ...s, loading: false }))
        return
      }
      setState((s) => ({
        ...s,
        meta: r.meta,
        datasetPath: r.path,
        frames: [],
        selectedEpisode: null,
        loading: false,
      }))
      if (r.meta.episodes.length > 0) await selectEpisode(0)
    } catch (e) {
      console.error(e)
      setState((s) => ({ ...s, loading: false }))
    }
  }, [selectEpisode])

  const openRecentPath = useCallback(async (path: string): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const r = await window.lerobot.openRecent(path)
      if (!r) {
        setState((s) => ({ ...s, loading: false }))
        return false
      }
      setState((s) => ({
        ...s,
        meta: r.meta,
        datasetPath: r.path,
        frames: [],
        selectedEpisode: null,
        loading: false,
      }))
      if (r.meta.episodes.length > 0) await selectEpisode(0)
      return true
    } catch (e) {
      console.error(e)
      setState((s) => ({ ...s, loading: false }))
      return false
    }
  }, [selectEpisode])

  const clearEpisode = useCallback(() => {
    setState((s) => ({ ...s, frames: [], selectedEpisode: null }))
  }, [])

  const openUrdf = useCallback(async () => {
    const url = await window.lerobot.openUrdf()
    if (!url) return
    localStorage.setItem('lerobot:urdf', url)
    setState((s) => ({ ...s, urdfUrl: url }))
  }, [])

  return { ...state, openDataset, openRecentPath, selectEpisode, clearEpisode, openUrdf }
}
