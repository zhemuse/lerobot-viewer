import { ArrowLeft, ArrowRight, MessageSquare, PanelLeft } from 'lucide-react'
import type { DatasetMeta } from '@lerobot/lerobot-reader'
import { Logo } from './Logo'
import { useUIState, useUIDispatch } from '../state/UIState'

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
      {/* Logo（可点击回主页） */}
      <button
        type="button"
        onClick={onGoHome}
        title="回到主页"
        className="shrink-0 flex items-center justify-center rounded-md p-1 -m-1 text-[var(--ink)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Logo size={18} color="currentColor" />
      </button>

      {/* 侧栏折叠 + episode 前后：仅在进入回放时才有意义 */}
      {inPlayback && (
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => dispatch({ type: 'toggleSidebar' })}
            title={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'}
            className={iconBtn}
          >
            <PanelLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => canPrev && onSelectEpisode((selectedEpisode ?? 0) - 1)}
            disabled={!canPrev}
            title="上一个 episode"
            className={canPrev ? iconBtn : iconBtnDisabled}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => canNext && onSelectEpisode((selectedEpisode ?? 0) + 1)}
            disabled={!canNext}
            title="下一个 episode"
            className={canNext ? iconBtn : iconBtnDisabled}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 面包屑 */}
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

      {/* AI 聊天 */}
      <button
        type="button"
        title="AI 助手"
        className={iconBtn}
      >
        <MessageSquare size={14} />
      </button>
    </div>
  )
}
