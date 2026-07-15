import { useRef, useEffect, useState } from 'react'
import {
  PlaybackClock,
  PlayerProvider,
  PanelGridProvider,
  VideoPanel,
  JointCurvesPanel,
  RobotViewerPanel,
  FrameInspectorPanel,
  PanelShell,
} from '@lerobot/player'
import type { EpisodeFrame } from '@lerobot/lerobot-reader'
import { WelcomeScreen } from './WelcomeScreen'
import { LocalPlaybackBar } from './LocalPlaybackBar'
import { useTransportShortcuts } from '../hooks/useShortcuts'

interface PanelLayoutProps {
  frames: EpisodeFrame[]
  cameraNames: string[]
  jointNames: string[]
  fps: number
  selectedEpisode: number | null
  urdfUrl: string | null
  onOpenDataset: () => void
  onOpenUrdf: () => void
  onOpenRecent: (path: string) => Promise<boolean>
}

function pad6(n: number) {
  return String(n).padStart(6, '0')
}

export function PanelLayout({
  frames, cameraNames, jointNames, fps, selectedEpisode, urdfUrl,
  onOpenDataset, onOpenUrdf, onOpenRecent,
}: PanelLayoutProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [clock, setClock] = useState<PlaybackClock | null>(null)

  useEffect(() => {
    if (frames.length === 0) return
    const c = new PlaybackClock({ totalFrames: frames.length, fps: fps })
    setClock(c)
    return () => {
      c.destroy()
      setClock(null)
    }
  }, [frames, fps])

  if (!clock || frames.length === 0) {
    return (
      <WelcomeScreen
        onOpenDataset={onOpenDataset}
        onOpenUrdf={onOpenUrdf}
        onOpenRecent={onOpenRecent}
      />
    )
  }

  const totalFrames = frames.length
  const episodeIndex = selectedEpisode ?? 0

  return (
    <PlayerProvider clock={clock}>
      <TransportKeys />
      <div className="flex flex-col h-full">
        <PanelGridProvider value={gridRef}>
          <div ref={gridRef} className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">

            {/* 多路摄像头 */}
            {cameraNames.length > 0 && (
              <div
                className="grid gap-2 max-h-[40vh]"
                style={{ gridTemplateColumns: `repeat(${cameraNames.length}, minmax(0, 2fr))` }}
              >
                {cameraNames.map((cam) => {
                  const topicKey = `observation.images.${cam}`
                  return (
                    <VideoPanel
                      key={cam}
                      topicKey={topicKey}
                      src={window.lerobot.resolveVideoUrl(
                        `${topicKey}/episode_${pad6(episodeIndex)}.mp4`
                      )}
                      fps={fps}
                    />
                  )
                })}
              </div>
            )}

            {/* 3D 机器人 + 关节曲线（并排） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-h-[280px]">
              {urdfUrl ? (
                <RobotViewerPanel
                  frames={frames}
                  jointNames={jointNames}
                  urdf={{ urdfUrl, packages: {}, jointNames }}
                />
              ) : (
                <PanelShell title="3D Robot">
                  <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
                    <p className="text-xs text-[var(--ink-muted)]">
                      载入 URDF 以预览机器人模型
                    </p>
                    <button
                      type="button"
                      onClick={onOpenUrdf}
                      className="text-[12px] px-3 py-1.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-125 transition-all"
                    >
                      加载 URDF
                    </button>
                  </div>
                </PanelShell>
              )}
              <JointCurvesPanel
                frames={frames}
                jointNames={jointNames}
                fps={fps}
                totalFrames={totalFrames}
                isLoading={false}
              />
            </div>

            {/* 帧数据检视 */}
            <div className="min-h-40">
              <FrameInspectorPanel
                frames={frames}
                jointNames={jointNames}
              />
            </div>

          </div>
        </PanelGridProvider>

        {/* 播放控制条 */}
        <LocalPlaybackBar totalFrames={totalFrames} fps={fps} />
      </div>
    </PlayerProvider>
  )
}

function TransportKeys() {
  useTransportShortcuts()
  return null
}
