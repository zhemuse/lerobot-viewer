# @lerobot-viewer/player — SDK design

**[中文](DESIGN.zh-CN.md) | English**

`@lerobot-viewer/player` is a multimodal playback SDK for [LeRobot](https://github.com/huggingface/lerobot) datasets. A LeRobot episode bundles heterogeneous streams — multi-camera video, per-frame joint state (`observation.state`), per-frame commanded action, and a URDF robot description — all of which must play back **strictly time-aligned** under a single clock.

That's the one problem this SDK solves. Everything else is a consequence.

The SDK ships as a React library (`react >=18` peer) and runs unchanged in both the browser and Electron.

---

## 1. Architecture at a glance

Three layers, each narrower in responsibility than the one below it:

```
┌────────────────────────────────────────────────────┐
│                Application layer                    │
│  Web:      pull from HTTP API                       │
│  Electron: main-process reader → IPC → renderer     │
│  Both convert their data into EpisodeFrame[]        │
└──────────────────────┬─────────────────────────────┘
                       │ props
┌──────────────────────▼─────────────────────────────┐
│              UI panels (ui/)                        │
│  VideoPanel  JointCurvesPanel  RobotViewerPanel     │
│  FrameInspectorPanel   PlaybackControls             │
└──────────────────────┬─────────────────────────────┘
                       │ useSubscribe / usePlayerState / usePlayerActions
┌──────────────────────▼─────────────────────────────┐
│               Hooks (hooks/)                        │
│  PlayerProvider  usePlayerState  usePlayerActions   │
│  useSubscribe    useVideoChannel                    │
└──────────────────────┬─────────────────────────────┘
                       │ clock.subscribe / clock.onStateChange
┌──────────────────────▼─────────────────────────────┐
│                Core (core/)                         │
│                 PlaybackClock                       │
└────────────────────────────────────────────────────┘
```

| Layer | Responsibility |
|---|---|
| **Core** | Pure TS clock. No React, no DOM assumptions. Reusable in workers, Node, or a future non-React port. |
| **Hooks** | Bridge clock into React lifecycle. Explicitly split high-frequency (rAF) vs low-frequency (throttled) channels so consumers pick what they need. |
| **UI** | Composable panels. Each is a `PanelShell` around a subscriber — zero layout coupling. |

Also shipped: `base/` (framework-agnostic primitives like `IDisposable` / `DisposableStore`), consumable via the `@lerobot-viewer/player/base` subpath.

---

## 2. Core: `PlaybackClock`

The clock is the SDK's heartbeat. Every panel (video, chart, 3D) reads from **one** `PlaybackClock` instance — that's what makes synchronization trivial.

### 2.1 Data model

```ts
interface ClockState {
  currentFrame: number
  isPlaying: boolean
  rate: number           // 0.5 / 1 / 2 / …
  totalFrames: number
  fps: number
}

interface ClockOptions {
  totalFrames: number
  fps: number
  throttle?: number      // frames between low-freq notifications (default 3)
}
```

### 2.2 Two subscription channels

`PlaybackClock` maintains two independent listener sets. This resolves the natural tension between "drive at rAF" and "update React sparingly":

| Channel | Frequency | Typical consumer |
|---|---|---|
| `subscribe(FrameCallback)` | Every rAF (~60 Hz) | 3D pose driver, chart playhead redraw |
| `onStateChange(cb)` | Every `throttle` frames (~20 Hz) | Progress bar, timecode, play/pause button |

Result: React re-renders at most 20 Hz, while 3D and chart still animate at native frame rate — no virtual-DOM diffing in the hot path.

### 2.3 Wall-clock–driven rAF loop

```
play() → requestAnimationFrame(_tick)
  _tick(timestamp):
    delta = timestamp - lastTimestamp
    currentTime += delta * rate
    if (reached end) → stop + notify
    notifySubscribers()          // high-freq
    if (framesSinceNotify >= throttle):
      notifyStateListeners()     // low-freq
    requestAnimationFrame(_tick) // continue
```

Time advances by **elapsed wall time**, not by frame count. Rate changes take effect on the next tick with no need to restart the loop.

### 2.4 Backgrounded-tab handling

On `visibilitychange` (tab returns), `_lastTimestamp` resets to `null`. The next tick skips its delta calculation, which prevents the clock from lurching forward by all the elapsed hidden time.

### 2.5 `currentTimeRef` — the zero-overhead escape hatch

```ts
readonly currentTimeRef: { current: number } = { current: 0 }
```

`RobotViewerPanel`'s `usePlaybackSync` reads this directly inside R3F's `useFrame`. No subscription, no React reconciliation — just a pointer.

---

## 3. Hooks

### 3.1 `PlayerProvider` / `usePlayerContext`

```tsx
<PlayerProvider clock={clock}>{children}</PlayerProvider>
```

The provider does not own the clock's lifecycle. The application creates it (typically in a `useMemo`) and disposes it (`clock.destroy()`) on unmount / episode change. That's deliberate: the SDK doesn't guess when the clock should be recreated.

### 3.2 `usePlayerState()` — throttled

Returns the throttled `ClockState`. Meant for progress bar / timecode / play indicator UIs.

### 3.3 `usePlayerActions()` — stable

Returns `{ play, pause, seek, setRate }` with stable identities via `useCallback`. Safe to put in `useEffect` deps or hand to `onClick`.

### 3.4 `useSubscribe(cb)` — high frequency

Fires the callback on every rAF tick with **zero React re-renders**. Internally holds `cb` in a ref, so callers don't need to memoize.

### 3.5 `useVideoChannel(fps)`

Multi-`<video>` registration hub. Subscribes to the clock and does three things:

1. **Play/pause & rate sync**: piggybacks on the low-frequency channel.
2. **Drift correction**: on a 10 Hz interval (only while playing), compares each video's `currentTime` against the clock and snaps back if the drift exceeds `2/fps` seconds.
3. **Registration**: `registerVideo(key, null)` auto-unregisters — pair with a React `ref` callback for clean unmounts.

The 10 Hz cadence is deliberate. Earlier iterations ran per-rAF and became a hot spot when N cameras > 4.

---

## 4. UI

Every panel wraps its content in `PanelShell`, which provides a title bar, badges, and fullscreen toggle.

### 4.1 `PanelShell`

```
┌────────────────────────────────────┐
│ [icon] Title  [badge]  [···] [⛶]   │  ← toolbar, 28px
├────────────────────────────────────┤
│                                    │
│         children                   │  ← flex-1, position:relative
│                                    │
└────────────────────────────────────┘
```

Fullscreen mounts the panel as `position: absolute; inset: 0; z-index: 50`, animated with `motion/react`'s `layout` prop. ESC exits.

### 4.2 `PlaybackControls`

Consumes `usePlayerState` and `usePlayerActions`. Provides:

- Prev / play-pause / next-frame buttons
- Frame index, timecode (`mm:ss.cc`), FPS
- Rate selector (0.5× / 1× / 1.5× / 2× / 3× / 5× / 10×)
- Draggable scrubber (Base UI Slider)
- Optional `strip` slot for embedding extras (e.g. frame thumbnails)

### 4.3 `VideoPanel`

```tsx
<VideoPanel topicKey="observation.images.top_rgb" src={url} fps={30} />
```

Registers its `<video>` with `useVideoChannel`. The clock does the rest — no imperative video control at the call site.

### 4.4 `JointCurvesPanel`

[uPlot](https://github.com/leeoniya/uPlot)-based time-series chart. Solid line = state, dashed = action.

**Data flow**:
```
EpisodeFrame[] → downsampleColumnar (≤ 1500 points) → uPlot.AlignedData
```

Key features:

| Feature | How |
|---|---|
| State vs action | `series[].dash` |
| Consistent joint colors | `jointColor(index)` palette |
| Joint filter | `JointSelector` popover |
| Playhead cursor | Custom draw hook — yellow dashed vertical line |
| Click-to-seek | `mousedown` → `posToVal` → nearest-frame binary search → `seek()` |
| Tooltip | Per-joint values on hover; locked on click |
| Responsive sizing | `ResizeObserver` → `plot.setSize()` |

**Downsampling** (`downsampleColumnar`): divides frames into N equal-width buckets, retains the global min/max index per bucket across all joint columns. O(n·cols), preserves waveform extremes. Good enough when joints are correlated (same robot).

### 4.5 `RobotViewerPanel`

React-Three-Fiber + `urdf-loader` 3D viewport.

**Load flow**:
```
urdfUrl → URDFLoader.loadAsync()
  loadMeshCb:
    .stl → STLLoader + effect-scoped geometry cache
    .dae → ColladaLoader
  → compute bounding box → fitCameraToBox (auto-fit camera)
  → render
```

**Pose sync** (`usePlaybackSync`): inside R3F's `useFrame`, reads `clock.currentTimeRef.current`, does a binary search over `frames`, and calls `robot.setJointValue()` only when the frame index changes. No React state involvement.

**Coordinate frame**: URDF is Z-up; Three.js is Y-up. Two rotations (`-π/2` around X, `+π/2` around Y) are pre-composed into a single quaternion applied at the root group.

**Interaction**: hover to highlight a link's meshes (including fixed children); tooltip shows link name, parent joint type, mass.

**Theme**: accepts `theme?: 'light' | 'dark' | 'system' | 'dom-class'`, defaults to `'system'`. The library does not couple to any specific ThemeProvider.

**STL cache**: geometry cache is **scoped to the load effect**, not module-level. On URDF switch or unmount the cache disposes every geometry (`.dispose()`) and resets. This prevents unbounded GPU memory growth when users switch datasets.

### 4.6 `FrameInspectorPanel`

Trivial per-frame table. Reads `usePlayerState().currentFrame`, indexes into `frames`, renders each joint's state / action to four decimals.

---

## 5. Core types

```ts
/** Per-frame data, produced by the application layer. */
interface EpisodeFrame {
  frameIndex: number
  timestamp: number         // seconds — must align with video timing
  jointPositions: number[]  // state, radians
  actionPositions: number[] // action, radians
}

/** URDF configuration. */
interface UrdfConfig {
  urdfUrl: string
  packages: Record<string, string>  // package name → URL prefix
  jointNames: string[]
}
```

---

## 6. Performance notes

| Concern | Approach |
|---|---|
| 60 Hz clock should not force 60 Hz React re-renders | `throttle` (default 3) on the low-freq channel |
| Multi-video drift | 10 Hz interval + threshold-based correction (not per-frame) |
| 3D joint updates should not touch React | R3F `useFrame` reads `currentTimeRef` directly |
| Large datasets pin the chart | `downsampleColumnar` caps at ~1500 points |
| uPlot series toggle | `prevSeriesShowRef` diff; `setSeries` only for series that actually changed |
| STL mesh reuse within a URDF | Effect-scoped cache with `.dispose()` on cleanup |
| Callback churn triggering effect re-runs | Callbacks kept in refs, never listed in deps |

---

## 7. Usage

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
} from '@lerobot-viewer/player'
import type { EpisodeFrame, UrdfConfig } from '@lerobot-viewer/player'

export function EpisodePlayer({
  frames, videoUrls, urdf,
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
        <div ref={gridRef} className="relative grid grid-cols-3 gap-2 h-screen p-2">
          {Object.entries(videoUrls).map(([key, src]) => (
            <VideoPanel key={key} topicKey={key} src={src} fps={50} />
          ))}
          <JointCurvesPanel
            frames={frames}
            jointNames={urdf.jointNames}
            fps={50}
            totalFrames={frames.length}
            isLoading={false}
          />
          <RobotViewerPanel frames={frames} jointNames={urdf.jointNames} urdf={urdf} />
          <FrameInspectorPanel frames={frames} jointNames={urdf.jointNames} />
        </div>
        <PlaybackControls totalFrames={frames.length} fps={50} />
      </PlayerProvider>
    </PanelGridProvider>
  )
}
```

---

## 8. Extension points

| Extension | Approach |
|---|---|
| New panel type (point cloud, force curves, …) | Subscribe with `useSubscribe`, wrap in `PanelShell`. Core untouched. |
| Multi-episode compare | Nest two `PlayerProvider`s with independent clocks. |
| Custom transport strip (e.g. thumbnails) | Pass to `PlaybackControls`'s `strip` prop. |
| SSR / Next.js | `PlaybackClock` guards `document` / `requestAnimationFrame`; panel modules ship `'use client'`. |
| Electron desktop | Core has no browser-specific APIs; video `src` can point at custom protocols like `lerobot://`. |
