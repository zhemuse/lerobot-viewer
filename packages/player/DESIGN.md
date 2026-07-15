# @lerobot/player — 多模态数据播放器 SDK 设计文档

## 1. 概述

`@lerobot/player` 是一个面向 [LeRobot](https://github.com/huggingface/lerobot) 数据集的多模态回放 SDK，用于在 Web 端同步播放机器人采集的多路数据。

LeRobot 是 Hugging Face 开源的具身智能框架，其数据集以 Episode 为单位存储，每个 Episode 包含：

- 多路摄像头视频（`observation.images.*`）
- 每帧关节状态（`observation.state`，即实际位置）
- 每帧控制动作（`action`，即期望指令）
- 机器人 URDF 模型描述

SDK 的核心任务是将上述多路数据在时间轴上严格对齐，以统一时钟驱动播放：

- **视频流**：多路摄像头画面（RGB / 深度等）
- **关节曲线**：关节 State（实测位置）与 Action（指令位置）的时序对比曲线
- **3D 机器人模型**：基于 URDF 的实时姿态可视化，随帧驱动关节角度
- **帧数据检视**：逐帧查看各关节的 State / Action 数值

SDK 以 React 库的形式发布（`peerDependencies: react >=18`），提供 **Core / Hooks / UI** 三层 API，应用层只需把 LeRobot API 返回的帧数据转换为 `EpisodeFrame[]`，无需关心时钟同步细节。SDK 同时支持 **Web 浏览器**和 **Electron 桌面客户端**两种宿主环境。

---

## 2. 整体架构

```
┌─────────────────────────────────────────────┐
│                   应用层（Feature）           │
│  Web：从 HTTP API 拉取数据                   │
│  Electron：Node 端读取/解析后经 IPC/RPC 传入 │
│  统一转换为 EpisodeFrame[] 传给 SDK           │
└───────────────────────┬─────────────────────┘
                        │ props
┌───────────────────────▼─────────────────────┐
│              UI 面板层（ui/）                  │
│  VideoPanel  JointCurvesPanel  RobotViewerPanel  FrameInspectorPanel  │
│                PlaybackControls                │
└───────────────────────┬─────────────────────┘
                        │ useSubscribe / usePlayerState / usePlayerActions
┌───────────────────────▼─────────────────────┐
│              Hooks 层（hooks/）               │
│  PlayerProvider  usePlayerState  usePlayerActions  useSubscribe  useVideoChannel  │
└───────────────────────┬─────────────────────┘
                        │ clock.subscribe / clock.onStateChange
┌───────────────────────▼─────────────────────┐
│           Core 层（core/）                    │
│              PlaybackClock                   │
└─────────────────────────────────────────────┘
```

三层职责分离：

| 层 | 职责 |
|---|---|
| **Core** | 纯 JS 时钟，不依赖 React，可在 Web Worker、Electron 主/渲染进程中复用 |
| **Hooks** | 把时钟状态桥接进 React 生命周期，控制渲染频率 |
| **UI** | 可组合的面板组件，消费 Hooks，零布局耦合 |

---

## 3. Core 层：PlaybackClock

### 3.1 设计目标

时钟是整个 SDK 的心跳。所有面板（视频、图表、3D）都以同一个 `PlaybackClock` 实例为时间基准，保证多路数据严格同步。

### 3.2 核心数据结构

```ts
interface ClockState {
  currentFrame: number   // 当前帧索引
  isPlaying: boolean
  rate: number           // 播放倍速（0.5 / 1 / 2 / ...）
  totalFrames: number
  fps: number
}

interface ClockOptions {
  totalFrames: number
  fps: number
  throttle?: number      // 状态通知节流（帧数间隔，默认 3）
}
```

### 3.3 双订阅机制

PlaybackClock 维护两套独立的订阅者集合，解决"高频驱动"与"低频刷新 React"之间的矛盾：

| 订阅类型 | 触发时机 | 典型消费者 |
|---|---|---|
| `subscribe(FrameCallback)` | 每个 RAF 帧（约 60fps） | 3D 机器人姿态、图表 playhead |
| `onStateChange(cb)` | 每 `throttle` 帧一次（约 20fps） | 进度条、时间码、播放/暂停按钮 |

这样 React 组件最多以 20fps 重渲，而 3D 和图表仍以原生帧率驱动，避免不必要的虚拟 DOM diff。

### 3.4 时间驱动（rAF loop）

```
play() → requestAnimationFrame(_tick)
  _tick(timestamp):
    delta = timestamp - lastTimestamp
    currentTime += delta * rate
    if (到达终点) → 停止 + 通知
    notifySubscribers()          // 高频，每帧
    if (framesSinceNotify >= throttle):
      notifyStateListeners()     // 低频，节流
    requestAnimationFrame(_tick) // 继续
```

时钟以**实际经过的墙钟时间**驱动，而非帧计数累加，因此倍速切换（`setRate`）无需重启循环。

### 3.5 页面可见性处理

当浏览器标签页切换到后台再回前台时，`visibilitychange` 事件将 `_lastTimestamp` 重置为 `null`，下一个 tick 跳过 delta 计算，防止时钟跳帧。

### 3.6 currentTimeRef（零开销直读）

```ts
readonly currentTimeRef: { current: number } = { current: 0 }
```

3D Viewer 的 `usePlaybackSync` 在 R3F `useFrame` 中直读此 ref，完全绕过 React 订阅，无额外开销。

---

## 4. Hooks 层

### 4.1 PlayerProvider / PlayerContext

```tsx
<PlayerProvider clock={clock}>
  {children}
</PlayerProvider>
```

`PlayerProvider` 接收外部创建的 `PlaybackClock` 实例，通过 `onStateChange` 订阅低频状态，并以 `useState` 驱动 React 重渲染。子树中任意组件均可通过 `usePlayerContext()` 获取 `{ clock, state }`。

**关键设计**：clock 实例由应用层创建并传入，Provider 不负责生命周期管理，便于在 episode 切换时销毁重建。

### 4.2 usePlayerState

```ts
function usePlayerState(): ClockState
```

返回低频（节流后）的 `ClockState`，专供进度条、时间码等 UI 消费。每次重渲染只更新实际变化的状态字段。

### 4.3 usePlayerActions

```ts
function usePlayerActions(): { play, pause, seek, setRate }
```

返回稳定引用的操作函数（`useCallback` 封装），可安全放入 `onClick` 或 `useEffect` 依赖数组，不会引起额外重渲染。

### 4.4 useSubscribe

```ts
function useSubscribe(cb: FrameCallback): void
```

高频订阅，每 RAF 帧回调，**零 React 重渲染**。内部用 `useRef` 持有最新 `cb`，调用方无需 `useCallback` 包裹。适合驱动图表 playhead 等命令式操作。

### 4.5 useVideoChannel

```ts
function useVideoChannel(fps: number): {
  registerVideo: (key: string, el: HTMLVideoElement | null) => void
}
```

多路 `<video>` 注册中心，订阅时钟做两件事：

1. **播放/暂停 & 倍速同步**：监听低频状态变化，批量同步所有已注册的 video 元素。
2. **漂移纠偏**：高频订阅 `clock.subscribe`，检测 `video.currentTime` 与时钟时间的偏差，超过 `2/fps` 秒时强制 seek 修正。

`registerVideo(key, null)` 自动注销，配合 `ref` 回调实现组件卸载时的清理。

### 4.6 PanelGridContext

```ts
const PanelGridProvider = PanelGridContext.Provider
function usePanelGridRef(): RefObject<HTMLDivElement | null> | null
```

将面板网格容器的 DOM ref 注入 Context，供 `PanelShell` 的全屏逻辑读取挂载点（预留扩展，当前全屏采用 absolute overlay 实现）。

---

## 5. UI 层

所有面板均以 `PanelShell` 作为统一容器，具备标题栏、徽章、全屏切换等通用能力。

### 5.1 PanelShell

```
┌────────────────────────────────────┐
│ [icon] 标题  [badge]  [···] [⛶]   │  ← 工具栏，固定高度 28px
├────────────────────────────────────┤
│                                    │
│         children（内容区）          │  ← flex-1，相对定位，overflow hidden
│                                    │
└────────────────────────────────────┘
```

全屏时将面板设为 `position: absolute; inset: 0; z-index: 50`，以 `motion/react` 的 `layout` 动画过渡，ESC 键退出。

### 5.2 PlaybackControls

播放控制栏，消费 `usePlayerState` 和 `usePlayerActions`：

- 上一帧 / 播放暂停 / 下一帧 按钮
- 帧索引、时间码（`mm:ss.cc` 格式）、FPS 显示
- 倍速选择器（0.5× / 1× / 1.5× / 2× / 3× / 5× / 10×）
- 可拖动进度条（Base UI Slider）
- 可选的 `strip` 插槽（用于嵌入额外内容，如帧缩略图）

### 5.3 VideoPanel

```tsx
<VideoPanel topicKey="observation.images.top_rgb" src={url} fps={30} />
```

通过 `useVideoChannel` 注册 `<video>` 元素，时钟驱动播放/暂停/倍速/漂移纠偏，无需手动管理 video 状态。标题从 `topicKey` 中截取最后一段显示。

### 5.4 JointCurvesPanel

基于 [uPlot](https://github.com/leeoniya/uPlot) 的高性能时序图表面板。

**数据流**：
```
EpisodeFrame[] → downsampleColumnar（最多 1500 点）→ uPlot.AlignedData
```

**关键能力**：

| 能力 | 实现 |
|---|---|
| 实线 = 状态（State）、虚线 = 动作（Action） | `series[].dash` 区分 |
| 关节颜色一致性 | `jointColor(index)` 调色板 |
| 关节筛选器 | `JointSelector` Popover，支持单选 / 全选 |
| Playhead 竖线 | `uPlot hooks.draw` 在 canvas 上手绘黄色虚线 |
| 点击图表 seek | 鼠标 `mousedown` 解析 x 坐标还原帧索引，调用 `seek()` |
| Tooltip | 鼠标悬浮时显示当前帧各关节数值，点击后锁定 |
| 自适应尺寸 | `ResizeObserver` 触发 `plot.setSize()` |

**降采样算法**（`downsampleColumnar`）：

将全量帧划分为 N 个等宽桶，每桶保留跨所有关节的全局 min/max 索引点，确保波形峰谷不丢失。时间复杂度 O(n·cols)，适合关节运动相关性强的场景。

### 5.5 RobotViewerPanel

基于 React Three Fiber + URDF Loader 的 3D 机器人可视化面板。

**加载流程**：

```
urdfUrl → URDFLoader.loadAsync()
  └─ loadMeshCb:
       ├─ .stl → STLLoader + geometry cache（Map<cacheKey, Promise>）
       └─ .dae → ColladaLoader
  → 计算 BoundingBox → fitCameraToBox（相机自动适配）
  → setRobot(r)（触发渲染）
```

**姿态同步**（`usePlaybackSync`）：

在 R3F `useFrame` 中直读 `clock.currentTimeRef.current`（无订阅开销），二分查找最近帧，仅在帧索引变化时调用 `robot.setJointValue()`，避免冗余写入。

**坐标系转换**：

URDF 坐标为 Z 轴朝上，需转换为 Three.js 的 Y 轴朝上，同时面向摄像机方向：

```ts
// Z → Y：绕 X 轴旋转 -90°
// 面向摄像机：绕 Y 轴旋转 +90°
// 两次旋转预计算为单个四元数，挂在根 group 上
const COMBINED_QUATERNION = _qF.clone().multiply(_qZ)
```

**交互**：鼠标悬浮时高亮对应 Link 的所有 Mesh（包含 fixed 子关节），显示 Link 名称、父关节类型、质量等元数据。

### 5.6 FrameInspectorPanel

简单的逐帧数据表格，消费低频 `usePlayerState().currentFrame`，从 `frames[]` 中直接索引当前帧，展示每个关节的 State / Action 数值（4 位小数）。

---

## 6. 关键数据类型

```ts
/** 单帧归一化数据，Feature 层负责从 API 转换 */
interface EpisodeFrame {
  frameIndex: number       // 帧序号（从 0 开始）
  timestamp: number        // 秒，与视频时间对齐
  jointPositions: number[] // 关节状态角度（弧度）
  actionPositions: number[]// 期望动作角度（弧度）
}

/** URDF 配置 */
interface UrdfConfig {
  urdfUrl: string
  packages: Record<string, string>  // 包名 → CDN/本地 URL 前缀
  jointNames: string[]
}
```

---

## 7. 性能设计摘要

| 问题 | 方案 |
|---|---|
| 60fps 时钟不应引起 60fps React 重渲 | `throttle` 参数节流 `onStateChange`，默认每 3 帧通知一次 |
| 多路视频时间漂移 | `useVideoChannel` 高频检测 `video.currentTime` 偏差并纠偏 |
| 3D 关节更新无需走 React | `currentTimeRef` 直读 + R3F `useFrame`，完全绕过 React |
| 大数据集图表卡顿 | `downsampleColumnar` 将帧数压缩至最多 1500 点 |
| uPlot 系列可见性变更 | `prevSeriesShowRef` diff，仅对变化的 series 调用 `setSeries` |
| URDF Mesh 重复加载 | STL geometry 按 `(path, authToken)` 缓存 `Promise<BufferGeometry>` |
| 回调函数进入 useEffect deps 导致重加载 | 所有外部 callback 以 ref 持有，不进入 deps 数组 |

---

## 8. 使用示例

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PlaybackClock,
  PlayerProvider,
  PanelGridProvider,
  PlaybackControls,
  VideoPanel,
  JointCurvesPanel,
  RobotViewerPanel,
  FrameInspectorPanel,
} from '@lerobot/player'
import type { EpisodeFrame, UrdfConfig } from '@lerobot/player'

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

  // 随 frames 变化重建时钟
  const clock = useMemo(
    () => new PlaybackClock({ totalFrames: frames.length, fps: 50 }),
    [frames.length],
  )
  useEffect(() => () => clock.destroy(), [clock])

  const jointNames = urdf.jointNames

  return (
    <PanelGridProvider value={gridRef}>
      <PlayerProvider clock={clock}>
        <div ref={gridRef} className="relative grid grid-cols-3 gap-2 h-screen p-2">
          {Object.entries(videoUrls).map(([key, src]) => (
            <VideoPanel key={key} topicKey={key} src={src} fps={50} />
          ))}
          <JointCurvesPanel
            frames={frames}
            jointNames={jointNames}
            fps={50}
            totalFrames={frames.length}
            isLoading={false}
          />
          <RobotViewerPanel
            frames={frames}
            jointNames={jointNames}
            urdf={urdf}
          />
          <FrameInspectorPanel frames={frames} jointNames={jointNames} />
        </div>
        <PlaybackControls totalFrames={frames.length} fps={50} />
      </PlayerProvider>
    </PanelGridProvider>
  )
}
```

---

## 9. 扩展点

| 扩展需求 | 建议 |
|---|---|
| 新增面板类型（点云、力矩曲线等） | 实现 `useSubscribe` 高频消费 + `PanelShell` 包裹，无需修改 Core |
| 多 episode 同屏对比 | 创建两个 `PlaybackClock` 实例，嵌套两个 `PlayerProvider` |
| 帧缩略图时间轴 | 通过 `PlaybackControls` 的 `strip` prop 插入自定义内容 |
| 自定义倍速选项 | 当前硬编码在 `PlaybackControls`，可提取为 prop |
| SSR / Next.js 兼容 | `PlaybackClock` 已做 `typeof document !== 'undefined'` 防护；面板组件添加 `'use client'` 指令 |
| Electron 桌面客户端 | Core 层无浏览器特定 API 依赖（rAF / visibilitychange 均有守卫），可直接在 Electron 渲染进程中使用；视频 src 支持本地 `file://` 路径或自定义协议 |
