# @lerobot-viewer/player

Multimodal playback SDK for [LeRobot](https://github.com/huggingface/lerobot) datasets. React + Three.js.

Aligns multi-camera video, joint state / action curves, and a URDF-driven 3D robot on a single clock, so every panel plays back frame-accurate. Works in the browser and in Electron.

- **`PlaybackClock`** — rAF-driven clock with a split high-freq / low-freq subscription model
- **`<VideoPanel>` / `<JointCurvesPanel>` / `<RobotViewerPanel>` / `<FrameInspectorPanel>`** — composable panels
- **`useSubscribe` / `useVideoChannel`** — the hooks that make the panels above trivial
- **No opinions on data source** — you convert your API/IPC/parquet data into `EpisodeFrame[]` and hand it to the SDK

## Install

```bash
npm install @lerobot-viewer/player \
  react react-dom three @react-three/fiber @react-three/drei
```

React ≥ 18, Three ≥ 0.160, `@react-three/fiber` ≥ 9, `@react-three/drei` ≥ 10 are declared as `peerDependencies`.

## Quick example

```tsx
import { useEffect, useMemo, useRef } from 'react'
import {
  PlaybackClock,
  PlayerProvider,
  PanelGridProvider,
  PlaybackControls,
  VideoPanel,
  JointCurvesPanel,
  RobotViewerPanel,
  FrameInspectorPanel,
  type EpisodeFrame,
  type UrdfConfig,
} from '@lerobot-viewer/player'

export function EpisodePlayer({
  frames,
  videoUrls,
  urdf,
}: {
  frames: EpisodeFrame[]
  videoUrls: Record<string, string>
  urdf: UrdfConfig
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const clock = useMemo(
    () => new PlaybackClock({ totalFrames: frames.length, fps: 50 }),
    [frames.length],
  )
  useEffect(() => () => clock.destroy(), [clock])

  return (
    <PanelGridProvider value={gridRef}>
      <PlayerProvider clock={clock}>
        <div ref={gridRef} className="grid grid-cols-3 gap-2 h-screen">
          {Object.entries(videoUrls).map(([k, src]) => (
            <VideoPanel key={k} topicKey={k} src={src} fps={50} />
          ))}
          <RobotViewerPanel frames={frames} jointNames={urdf.jointNames} urdf={urdf} />
          <JointCurvesPanel
            frames={frames}
            jointNames={urdf.jointNames}
            fps={50}
            totalFrames={frames.length}
            isLoading={false}
          />
          <FrameInspectorPanel frames={frames} jointNames={urdf.jointNames} />
        </div>
        <PlaybackControls totalFrames={frames.length} fps={50} />
      </PlayerProvider>
    </PanelGridProvider>
  )
}
```

## Subpath exports

| Subpath | Contents |
|---|---|
| `@lerobot-viewer/player` | Everything (default) |
| `@lerobot-viewer/player/base` | `IDisposable` / `Disposable` / `DisposableStore` (no React) |
| `@lerobot-viewer/player/core` | `PlaybackClock` + types (no React) |
| `@lerobot-viewer/player/hooks` | React hooks — smaller import surface if you're building your own panels |
| `@lerobot-viewer/player/ui` | UI panels only |

## Design

See [DESIGN.md](./DESIGN.md) for the architecture rationale.

## License

MIT
