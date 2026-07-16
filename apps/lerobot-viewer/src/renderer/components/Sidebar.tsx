import type { DatasetMeta, EpisodeInfo } from '@lerobot-viewer/reader'
import { Search } from 'lucide-react'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { useUIDispatch, useUIState } from '../state/UIState'
import { EpisodeList } from './EpisodeList'

interface SidebarProps {
  meta: DatasetMeta | null
  episodes: EpisodeInfo[]
  selectedEpisode: number | null
  onSelectEpisode: (index: number) => void
  fps: number
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="h-8 px-3 flex items-center border-b border-[var(--border-subtle)] shrink-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-subtle)]">
        {children}
      </span>
    </div>
  )
}

function pad6(n: number) {
  return String(n).padStart(6, '0')
}

function formatDuration(totalFrames: number, fps: number): string {
  if (fps <= 0) return `${totalFrames}f`
  const totalS = totalFrames / fps
  if (totalS < 60) return `${totalS.toFixed(1)}s`
  const m = Math.floor(totalS / 60)
  const s = Math.round(totalS % 60)
  return `${m}m ${s}s`
}

function EpisodesSection({ meta, episodes, selectedEpisode, onSelectEpisode, fps }: SidebarProps) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return episodes
    const q = query.toLowerCase()
    return episodes.filter((ep) => {
      const name = `ep_${pad6(ep.episodeIndex)}`
      return name.includes(q) || (ep.task ?? '').toLowerCase().includes(q)
    })
  }, [episodes, query])

  const totalFrames = useMemo(() => episodes.reduce((sum, ep) => sum + ep.length, 0), [episodes])

  return (
    <>
      <SectionHeader>Episodes {episodes.length > 0 && `· ${episodes.length}`}</SectionHeader>

      {episodes.length > 0 && (
        <div className="shrink-0 px-3 pt-2 pb-2 flex flex-col gap-2 border-b border-[var(--border-subtle)]">
          {/* Dataset summary chip */}
          {meta && (
            <div className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-[11px] text-[var(--ink-muted)] tabular-nums">
              <span>{meta.totalEpisodes}ep</span>
              <span className="text-[var(--ink-subtle)]">·</span>
              <span>{meta.cameraNames.length}cam</span>
              <span className="text-[var(--ink-subtle)]">·</span>
              <span>{meta.jointNames.length}dof</span>
              <span className="text-[var(--ink-subtle)]">·</span>
              <span>{meta.fps}fps</span>
            </div>
          )}

          {/* Totals */}
          <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-subtle)] tabular-nums">
            <span>{totalFrames.toLocaleString()} frames</span>
            <span>{formatDuration(totalFrames, fps)}</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--bg)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] transition-colors">
            <Search size={12} className="text-[var(--ink-subtle)] shrink-0" />
            <input
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] focus:outline-none min-w-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[11px] text-[var(--ink-subtle)] hover:text-[var(--ink)] shrink-0"
                title="Clear"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <EpisodeList
          episodes={filtered}
          selected={selectedEpisode}
          onSelect={onSelectEpisode}
          fps={fps}
        />
      </div>
    </>
  )
}

export function Sidebar({ meta, episodes, selectedEpisode, onSelectEpisode, fps }: SidebarProps) {
  const { sidebarWidth } = useUIState()
  const dispatch = useUIDispatch()
  const dragStartX = useRef<number | null>(null)
  const dragStartWidth = useRef<number>(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragStartX.current = e.clientX
      dragStartWidth.current = sidebarWidth
      const onMove = (ev: MouseEvent) => {
        if (dragStartX.current === null) return
        const delta = ev.clientX - dragStartX.current
        dispatch({ type: 'setSidebarWidth', width: dragStartWidth.current + delta })
      }
      const onUp = () => {
        dragStartX.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [dispatch, sidebarWidth],
  )

  return (
    <div
      className="shrink-0 border-r border-[var(--border)] bg-[var(--bg-panel)] flex flex-row overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        <EpisodesSection
          meta={meta}
          episodes={episodes}
          selectedEpisode={selectedEpisode}
          onSelectEpisode={onSelectEpisode}
          fps={fps}
        />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={onMouseDown}
        className="w-1 cursor-col-resize hover:bg-[var(--border-hover)] transition-colors"
      />
    </div>
  )
}
