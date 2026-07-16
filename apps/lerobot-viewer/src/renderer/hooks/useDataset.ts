import type { DatasetMeta, EpisodeFrame } from '@lerobot-viewer/reader'
import { useCallback, useRef, useState } from 'react'

interface DatasetState {
  meta: DatasetMeta | null
  datasetPath: string | null
  frames: EpisodeFrame[]
  selectedEpisode: number | null
  urdfUrl: string | null
  loading: boolean
  error: Error | null
}

export function useDataset() {
  const [state, setState] = useState<DatasetState>({
    meta: null,
    datasetPath: null,
    frames: [],
    selectedEpisode: null,
    urdfUrl: localStorage.getItem('lerobot:urdf'),
    loading: false,
    error: null,
  })

  // Monotonic generation counter — every async op bumps and captures. When a
  // response comes back, we only apply it if the generation hasn't moved (i.e.
  // no newer op has been kicked off in the meantime). This kills the "open B
  // while A is loading, then A's stale frames flash into the UI" race.
  const loadGenRef = useRef(0)

  const selectEpisode = useCallback(async (episodeIndex: number) => {
    const gen = ++loadGenRef.current
    setState((s) => ({
      ...s,
      loading: true,
      selectedEpisode: episodeIndex,
      frames: [],
      error: null,
    }))
    try {
      const frames = await window.lerobot.loadEpisode(episodeIndex)
      if (gen !== loadGenRef.current) return
      setState((s) => ({ ...s, frames, loading: false }))
    } catch (e) {
      if (gen !== loadGenRef.current) return
      console.error(e)
      setState((s) => ({ ...s, loading: false, error: e as Error }))
    }
  }, [])

  const openDataset = useCallback(async () => {
    const gen = ++loadGenRef.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const r = await window.lerobot.openDataset()
      if (gen !== loadGenRef.current) return
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
      if (gen !== loadGenRef.current) return
      console.error(e)
      setState((s) => ({ ...s, loading: false, error: e as Error }))
    }
  }, [selectEpisode])

  const openRecentPath = useCallback(
    async (path: string): Promise<boolean> => {
      const gen = ++loadGenRef.current
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const r = await window.lerobot.openRecent(path)
        if (gen !== loadGenRef.current) return false
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
        if (gen !== loadGenRef.current) return false
        console.error(e)
        setState((s) => ({ ...s, loading: false, error: e as Error }))
        return false
      }
    },
    [selectEpisode],
  )

  const clearEpisode = useCallback(() => {
    // Also invalidate any in-flight load so its response doesn't repopulate.
    loadGenRef.current += 1
    setState((s) => ({ ...s, frames: [], selectedEpisode: null }))
  }, [])

  const openUrdf = useCallback(async () => {
    const url = await window.lerobot.openUrdf()
    if (!url) return
    localStorage.setItem('lerobot:urdf', url)
    setState((s) => ({ ...s, urdfUrl: url }))
  }, [])

  const dismissError = useCallback(() => {
    setState((s) => ({ ...s, error: null }))
  }, [])

  return {
    ...state,
    openDataset,
    openRecentPath,
    selectEpisode,
    clearEpisode,
    openUrdf,
    dismissError,
  }
}
