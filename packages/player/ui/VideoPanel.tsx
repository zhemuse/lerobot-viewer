'use client'
import { useVideoChannel } from '../hooks/useVideoChannel'
import { PanelShell } from './PanelShell'

interface VideoPanelProps {
  topicKey: string
  src: string
  fps: number
  loading?: boolean
}

function shortLabel(key: string): string {
  const parts = key.split('.')
  return parts[parts.length - 1] ?? key
}

export function VideoPanel({ topicKey, src, fps, loading }: VideoPanelProps) {
  const { registerVideo } = useVideoChannel(fps)

  return (
    <PanelShell
      title={shortLabel(topicKey)}
      badges={[topicKey.includes('rgb') ? 'RGB' : 'Color']}
      loading={loading}
      className="h-full"
    >
      {src ? (
        <video
          ref={(el) => registerVideo(topicKey, el)}
          className="w-full h-full object-contain"
          src={src}
          preload="auto"
          playsInline
          muted
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            No source
          </span>
        </div>
      )}
    </PanelShell>
  )
}
