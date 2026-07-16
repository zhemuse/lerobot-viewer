import type { DatasetMeta } from '@lerobot-viewer/reader'
import { ArrowLeft, ArrowRight, MessageSquare, PanelLeft } from 'lucide-react'
import { useUIDispatch, useUIState } from '../state/UIState'
import { Logo } from './Logo'

interface TopBarProps {
  datasetPath: string | null
  datasetMeta: DatasetMeta | null
  selectedEpisode: number | null
  onGoHome: () => void
  onSelectEpisode: (index: number) => void
}

function shortenPath(p: string, maxLen = 48): string {
  if (p.length <= maxLen) return p
  const head = p.slice(0, Math.floor(maxLen / 2) - 1)
  const tail = p.slice(-Math.floor(maxLen / 2) + 1)
  return `${head}…${tail}`
}

export function TopBar({
  datasetPath,
  datasetMeta,
  selectedEpisode,
  onGoHome,
  onSelectEpisode,
}: TopBarProps) {
  const { sidebarCollapsed } = useUIState()
  const dispatch = useUIDispatch()

  const inPlayback = selectedEpisode !== null && datasetMeta !== null
  const totalEp = datasetMeta?.totalEpisodes ?? 0
  const canPrev = inPlayback && (selectedEpisode ?? 0) > 0
  const canNext = inPlayback && (selectedEpisode ?? 0) < totalEp - 1

  const iconBtn =
    'w-7 h-7 flex items-center justify-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-hover)] transition-colors'
  const iconBtnDisabled =
    'w-7 h-7 flex items-center justify-center rounded-md text-[var(--ink-subtle)] opacity-40 cursor-not-allowed'

  return (
    <div className="flex items-center h-10 pl-4 pr-3 border-b border-[var(--border)] bg-[var(--bg)] shrink-0 gap-2">
      {/* Logo (click to return home) */}
      <button
        type="button"
        onClick={onGoHome}
        title="Home"
        className="shrink-0 flex items-center justify-center rounded-md p-1 -m-1 text-[var(--ink)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Logo size={18} color="currentColor" />
      </button>

      {/* Sidebar toggle + episode prev/next — only meaningful during playback */}
      {inPlayback && (
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => dispatch({ type: 'toggleSidebar' })}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={iconBtn}
          >
            <PanelLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => canPrev && onSelectEpisode((selectedEpisode ?? 0) - 1)}
            disabled={!canPrev}
            title="Previous episode"
            className={canPrev ? iconBtn : iconBtnDisabled}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => canNext && onSelectEpisode((selectedEpisode ?? 0) + 1)}
            disabled={!canNext}
            title="Next episode"
            className={canNext ? iconBtn : iconBtnDisabled}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      {datasetPath && (
        <>
          <div className="w-px h-4 bg-[var(--border)] shrink-0 ml-1" />
          <span
            className="font-mono text-[12px] text-[var(--ink-muted)] truncate"
            title={datasetPath}
          >
            {shortenPath(datasetPath)}
          </span>
        </>
      )}

      <div className="flex-1" />

      {/* AI chat */}
      <button type="button" title="AI assistant" className={iconBtn}>
        <MessageSquare size={14} />
      </button>
    </div>
  )
}
