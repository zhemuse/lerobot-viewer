import type { EpisodeInfo } from '@lerobot/lerobot-reader'

interface EpisodeListProps {
  episodes: EpisodeInfo[]
  selected: number | null
  onSelect: (index: number) => void
  fps: number
}

function pad6(n: number) {
  return String(n).padStart(6, '0')
}

function formatSeconds(frames: number, fps: number): string {
  if (fps <= 0) return `${frames}f`
  const s = frames / fps
  return `${s.toFixed(1)}s`
}

export function EpisodeList({ episodes, selected, onSelect, fps }: EpisodeListProps) {
  if (episodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-[var(--ink-subtle)] px-4 text-center">
        无匹配 episode
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-y-auto h-full py-1">
      {episodes.map((ep) => {
        const active = selected === ep.episodeIndex
        return (
          <button
            key={ep.episodeIndex}
            onClick={() => onSelect(ep.episodeIndex)}
            title={ep.task || undefined}
            className={[
              'flex items-center justify-between px-3 h-8 text-left transition-colors',
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink)] hover:bg-[var(--bg-hover)]',
            ].join(' ')}
          >
            <span className="font-mono text-[12px] truncate">
              ep_{pad6(ep.episodeIndex)}
            </span>
            <span
              className={[
                'font-mono text-[11px] shrink-0 tabular-nums',
                active ? 'text-[var(--accent)]/70' : 'text-[var(--ink-subtle)]',
              ].join(' ')}
            >
              {formatSeconds(ep.length, fps)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
