'use client'
import { PanelShell } from './PanelShell'
import { usePlayerState } from '../hooks/usePlayerState'
import type { EpisodeFrame } from '../core/types'

interface FrameInspectorPanelProps {
  frames: EpisodeFrame[]
  jointNames: string[]
  isLoading?: boolean
}

export function FrameInspectorPanel({ frames, jointNames, isLoading }: FrameInspectorPanelProps) {
  const { currentFrame } = usePlayerState()
  const frame = frames[currentFrame]

  return (
    <PanelShell title="Frame Inspector" loading={isLoading} className="h-full">
      <div className="overflow-auto h-full p-3">
        {frame ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ color: 'var(--ink-muted)' }}>
                <th className="pb-1 font-medium">Joint</th>
                <th className="pb-1 font-medium text-right">State</th>
                <th className="pb-1 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {jointNames.map((name, i) => (
                <tr key={name} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="py-0.5 pr-3 font-mono" style={{ color: 'var(--ink-muted)' }}>
                    {name}
                  </td>
                  <td className="py-0.5 text-right font-mono" style={{ color: 'var(--ink)' }}>
                    {frame.jointPositions[i]?.toFixed(4) ?? '—'}
                  </td>
                  <td className="py-0.5 text-right font-mono" style={{ color: 'var(--ink-muted)' }}>
                    {frame.actionPositions[i]?.toFixed(4) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            No frame data
          </span>
        )}
      </div>
    </PanelShell>
  )
}
