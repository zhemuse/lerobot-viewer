import { MoreVertical } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
    <path d="M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z" />
  </svg>
)
const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
    <path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z" />
  </svg>
)

interface PanelShellProps {
  title: ReactNode
  children: ReactNode
  loading?: boolean
  badges?: string[]
  icon?: ReactNode
  extraActions?: ReactNode
  showFullscreen?: boolean
  moreMenu?: ReactNode
  className?: string
}

export function PanelShell({
  title,
  children,
  loading,
  badges,
  icon,
  extraActions,
  showFullscreen = true,
  moreMenu,
  className,
}: PanelShellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterFullscreen = useCallback(() => setIsFullscreen(true), [])
  const exitFullscreen = useCallback(() => setIsFullscreen(false), [])

  useEffect(() => {
    if (!isFullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitFullscreen()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isFullscreen, exitFullscreen])

  const toolbar = (inFullscreen: boolean) => (
    <div className="flex items-center justify-between h-7 px-2.5 border-b border-[var(--border-subtle)] shrink-0 bg-[var(--bg-muted)]">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="flex items-center shrink-0 text-[var(--ink-muted)]">{icon}</span>}
        <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
          {title}
        </span>
      </div>

      <div className="flex items-center shrink-0">
        {badges?.map((b) => (
          <span
            key={b}
            className="text-[9px] font-medium px-[5px] py-px rounded shrink-0 mr-1"
            style={{ background: 'var(--bg-surface)', color: 'var(--ink-muted)' }}
          >
            {b}
          </span>
        ))}
        {extraActions}
        {showFullscreen && (
          <button
            type="button"
            onClick={inFullscreen ? exitFullscreen : enterFullscreen}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            {inFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        )}
        {moreMenu && (
          <button
            type="button"
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-white/10 text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors"
          >
            <MoreVertical size={10} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <motion.div
      ref={containerRef}
      layout
      className={cn(
        'flex flex-col overflow-hidden bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg',
        className,
      )}
      style={
        isFullscreen
          ? { position: 'absolute', inset: 0, zIndex: 50, borderRadius: 0, border: 'none' }
          : {}
      }
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
    >
      {toolbar(isFullscreen)}
      <div className="flex-1 relative overflow-hidden">
        {loading ? <div className="absolute inset-0 panel-shimmer" /> : children}
      </div>
    </motion.div>
  )
}
