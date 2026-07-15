# @lerobot/player — 多模态数据播放器 SDK 设计文档

## 1. 背景与目标

`@lerobot/player` 是一个面向 [LeRobot](https://github.com/huggingface/lerobot) 数据集的多模态回放 SDK。LeRobot 是 Hugging Face 开源的具身智能框架，其数据集以 Episode 为单位，每个 Episode 同时包含：多路摄像头视频、每帧的关节状态（`observation.state`，实测位置）、每帧的控制动作（`action`，指令位置）以及机器人的 URDF 模型。

SDK 要解决的核心问题只有一个：**让上述异构数据在时间轴上严格对齐，随一个统一的时钟播放**。围绕这个目标，SDK 提供以下面板：

- **VideoPanel**：多路摄像头画面（RGB / 深度等）
- **JointCurvesPanel**：关节 State 与 Action 的时序对比曲线
- **RobotViewerPanel**：基于 URDF 的 3D 机器人实时姿态
- **FrameInspectorPanel**：逐帧关节数值检视表

SDK 以 React 库形式发布（`peerDependencies: react >=18`），同时适配 **Web 浏览器**与 **Electron 桌面客户端**两种宿主：Core 层无 DOM 强依赖，Hook 与 UI 层复用同一套逻辑。

---

## 2. 整体架构

SDK 采用三层结构，自下而上依次收窄职责：

```
┌─────────────────────────────────────────────────┐
│                应用层 (Feature)                   │
│    Web：HTTP API 拉取                             │
│    Electron：Node 端读取 + IPC / RPC 传入          │
│    统一转换为 EpisodeFrame[] 后交给 SDK           │
└───────────────────────┬─────────────────────────┘
                        │ props
┌───────────────────────▼─────────────────────────┐
│                UI 层 (ui/)                        │
│  PanelShell · PlaybackControls · VideoPanel      │
│  JointCurvesPanel · RobotViewerPanel · ...        │
└───────────────────────┬─────────────────────────┘
                        │ hooks
┌───────────────────────▼─────────────────────────┐
│                Hooks 层 (hooks/)                  │
│  PlayerProvider · usePlayerState · useSubscribe  │
│  usePlayerActions · useVideoChannel · ...         │
└───────────────────────┬─────────────────────────┘
                        │ subscribe / onStateChange
┌───────────────────────▼─────────────────────────┐
│                Core 层 (core/)                    │
│                  PlaybackClock                    │
└─────────────────────────────────────────────────┘
```

| 层 | 职责 | React 依赖 |
|---|---|---|
| **Core** | 时钟推进、订阅分发 | 无 |
| **Hooks** | 把时钟状态桥接进 React，控制渲染频率 | 有 |
| **UI** | 可组合的面板组件，纯消费 Hooks | 有 |

分层的关键收益：Core 层可在 Web Worker、Electron 主进程或纯 Node 环境中独立运行；应用层只负责数据转换，不介入播放控制。

---

## 3. Core 层：PlaybackClock

时钟是整个 SDK 的心跳——所有面板都以同一个 `PlaybackClock` 实例为时间基准，多路数据的同步性由此保证。

### 3.1 数据结构

```ts
interface ClockState {
  currentFrame: number   // 当前帧索引
  isPlaying: boolean
  rate: number           // 播放倍速
  totalFrames: number
  fps: number
}

interface ClockOptions {
  totalFrames: number
  fps: number
  throttle?: number      // 状态通知节流间隔（帧数），默认 3
}
```

### 3.2 双订阅：高频驱动 vs 低频渲染

时钟内部维护两套独立的订阅者集合，这是 SDK 性能设计的核心——它化解了"每帧驱动 3D / 图表"与"React 组件不能每帧重渲"之间的矛盾：

| 订阅通道 | 触发时机 | 典型消费者 |
|---|---|---|
| `subscribe(FrameCallback)` | 每个 rAF 帧（约 60Hz） | 3D 机器人姿态、图表 playhead |
| `onStateChange(cb)` | 每 `throttle` 帧一次（约 20Hz） | 进度条、时间码、播放按钮 |

React 组件通过 `onStateChange` 走低频通道；3D、图表等命令式渲染走高频通道，直接绕过 React。默认参数下 React 侧最多 20fps 重渲，视觉表现却保持 60fps。

### 3.3 时间驱动：墙钟而非帧计数

```
_tick(timestamp):
  delta = (timestamp - _lastTimestamp) / 1000        // 真实经过秒数
  _currentTime += delta * _rate                       // 时间累加，非帧计数
  notifySubscribers()                                 // 高频广播
  if (framesSinceNotify >= throttle):
    notifyStateListeners()                            // 低频广播
  requestAnimationFrame(_tick)
```

时钟以 `requestAnimationFrame` 提供的高精度时间戳为基准推进 `_currentTime`，而非"每 tick 前进一帧"。这带来三个特性：

- 播放速度与屏幕刷新率解耦（60Hz / 120Hz 表现一致）
- 倍速切换只改乘数，无需重启循环
- 掉帧不会导致慢放，时间保持连续

### 3.4 页面可见性守护

浏览器标签页切换到后台时，rAF 会被节流甚至暂停。回到前台后如果直接使用累积的 `delta`，时钟会瞬间跳帧。SDK 监听 `visibilitychange`，切回前台时将 `_lastTimestamp` 重置为 `null`，下一 tick 丢弃累积 delta，播放从当前位置无缝继续。

### 3.5 currentTimeRef：零开销直读通道

```ts
readonly currentTimeRef: { current: number } = { current: 0 }
```

对于每帧都需要读取当前时间的场景（如 R3F 的 `useFrame`），订阅回调仍有函数调用开销。SDK 额外暴露一个 mutable ref，允许消费者直读 `_currentTime`，完全绕过订阅机制——这是 3D 姿态同步的关键性能路径。

---

## 4. Hooks 层

Hooks 层是 Core 与 React 之间的适配器，本身不含业务逻辑。

### 4.1 PlayerProvider

```tsx
<PlayerProvider clock={clock}>{children}</PlayerProvider>
```

Provider 接收由应用层创建的 `PlaybackClock` 实例，订阅 `onStateChange` 并以 `useState` 触发 React 重渲染。子树内任意组件可通过 `usePlayerContext()` 获取 `{ clock, state }`。

**设计取舍**：时钟实例由应用层持有而非 Provider 内部创建，便于在 Episode 切换时销毁重建。Provider 只负责桥接，不负责生命周期。

### 4.2 三个消费 Hook

| Hook | 通道 | 用途 |
|---|---|---|
| `usePlayerState()` | 低频状态订阅 | 进度条、时间码等随状态变化的 UI |
| `usePlayerActions()` | 稳定引用的操作函数 | `play` / `pause` / `seek` / `setRate`，可安全放入依赖数组 |
| `useSubscribe(cb)` | 高频每帧回调 | 图表 playhead 等命令式操作，零 React 重渲染 |

`useSubscribe` 内部用 `useRef` 持有最新回调，调用方无需 `useCallback` 包裹——这消除了一类常见的"忘记 memo 导致订阅反复重建"的错误。

### 4.3 useVideoChannel：多路视频同步

```ts
useVideoChannel(fps): { registerVideo(key, el | null): void }
```

`<video>` 元素本身带有独立的播放时钟，多路视频若各自播放会随时间累积漂移。`useVideoChannel` 承担协调职责：

1. **状态同步**：监听 `onStateChange`，批量对所有已注册的 video 元素调用 `play/pause` 与 `playbackRate` 赋值
2. **漂移纠偏**：订阅高频通道，检测 `video.currentTime` 与时钟时间的偏差，超过 `2/fps` 秒时强制 seek 修正

`registerVideo(key, null)` 表示注销，配合 React 的 ref 回调实现组件卸载时的自动清理。

### 4.4 PanelGridContext

`PanelGridProvider` 将面板网格容器的 DOM ref 注入 Context，供 `PanelShell` 的全屏切换读取挂载点。当前版本全屏采用 absolute overlay 实现，Context 作为扩展预留。

---

## 5. UI 层

所有面板以 `PanelShell` 为统一容器，具备标题栏、徽章、全屏切换、加载态遮罩等通用能力。这一层的所有组件仅通过 Hooks 与 Core 交互，彼此之间无耦合。

### 5.1 PanelShell

```
┌────────────────────────────────────┐
│ [icon] 标题  [badge]  [···] [⛶]   │  ← 工具栏，28px 固定高度
├────────────────────────────────────┤
│                                    │
│         children（内容区）           │  ← flex-1，相对定位
│                                    │
└────────────────────────────────────┘
```

全屏时将面板设为 `position: absolute; inset: 0; z-index: 50`，配合 `motion/react` 的 `layout` 动画平滑过渡，ESC 键退出。加载态渲染 shimmer 遮罩，避免闪烁。

### 5.2 PlaybackControls

播放控制栏，同时消费低频状态（`usePlayerState`）与稳定操作（`usePlayerActions`）：

- 上一帧 / 播放暂停 / 下一帧 按钮
- 帧索引、时间码（`m:ss.cc`）、FPS 显示
- 倍速选择器（0.5× / 1× / 1.5× / 2× / 3× / 5× / 10×）
- 可拖动进度条（Base UI Slider）
- 可选的 `strip` 插槽，用于嵌入帧缩略图等自定义内容

### 5.3 VideoPanel

```tsx
<VideoPanel topicKey="observation.images.top_rgb" src={url} fps={30} />
```

通过 `useVideoChannel` 将 `<video>` 元素注册到时钟通道，无需手动管理播放状态。标题从 `topicKey` 尾段截取，`RGB` / `Color` 徽章根据 key 内容推断。

### 5.4 JointCurvesPanel

基于 [uPlot](https://github.com/leeoniya/uPlot) 的时序图表面板。

**数据流**：
```
EpisodeFrame[] → downsampleColumnar (≤1500 点) → uPlot.AlignedData
```

**核心能力**：

| 能力 | 实现 |
|---|---|
| 实线 State / 虚线 Action | `series[].dash` 区分样式 |
| 关节配色一致 | `jointColor(index)` 调色板 |
| 关节筛选 | `JointSelector` Popover，支持单选与全选 |
| Playhead 竖线 | `uPlot hooks.draw` 直接在 canvas 上手绘 |
| 点击 seek | `mousedown` 反解 x 坐标为帧索引，调用 `seek()` |
| 悬浮 Tooltip | 显示当前帧各关节数值，点击可锁定 |
| 自适应尺寸 | `ResizeObserver` 触发 `plot.setSize()` |

**降采样策略**（`downsampleColumnar`）：LTTB 思想的简化版本——将全量帧划分为 N 个等宽桶，每桶保留跨所有关节的全局 min / max 索引点。相比逐列采样，此方案的图表峰谷特征更整体一致，适合关节运动相关性强的机器人场景；缺点是在关节独立性强的场景下可能损失个别通道的极值，可按需替换为逐列 LTTB。时间复杂度 O(n·cols)。

### 5.5 RobotViewerPanel

基于 React Three Fiber + `urdf-loader` 的 3D 机器人可视化面板。

**加载流程**：
```
urdfUrl → URDFLoader.loadAsync()
  loadMeshCb: .stl → STLLoader + geometry 缓存
              .dae → ColladaLoader
  → BoundingBox → fitCameraToBox (相机自动适配)
  → 挂载渲染
```

**姿态同步**（`usePlaybackSync`）：在 R3F 的 `useFrame` 中直读 `clock.currentTimeRef.current`（无订阅开销），二分查找匹配帧，仅当帧索引变化时调用 `robot.setJointValue()`，避免向 URDF 库冗余写入。

**坐标系对齐**：URDF 约定 Z 轴朝上，Three.js 约定 Y 轴朝上，同时希望机器人默认面向摄像机。SDK 将两次旋转预计算为单个四元数挂在根 group 上：

```ts
// Z → Y：绕 X 轴 -π/2；面向摄像机：绕 Y 轴 +π/2
const COMBINED_QUATERNION = _qF.clone().multiply(_qZ)
```

**交互**：鼠标悬浮时以自定义材质高亮 Link 及其所有 fixed 子 Link 的 Mesh，回调 `onLinkHover` 输出 Link 名称、父关节类型、质量、包含的子 Link 列表以及世界坐标——供应用层展示元数据浮层。

### 5.6 FrameInspectorPanel

轻量的逐帧数据表格，消费低频 `currentFrame` 直接索引 `frames[]`，展示每个关节的 State / Action 数值（4 位小数）。作为图表面板的数值补充。

---

## 6. 关键数据类型

SDK 与应用层之间只通过两个类型交换数据：

```ts
/** 单帧归一化数据；应用层负责从 LeRobot 数据转换 */
interface EpisodeFrame {
  frameIndex: number        // 帧序号（从 0 开始）
  timestamp: number         // 秒，与视频时间轴对齐
  jointPositions: number[]  // 关节实测角度（弧度）
  actionPositions: number[] // 关节指令角度（弧度）
}

/** URDF 加载配置 */
interface UrdfConfig {
  urdfUrl: string
  packages: Record<string, string>  // 包名 → URL 前缀
  jointNames: string[]              // 与 EpisodeFrame 中的顺序对齐
}
```

`jointNames` 的顺序必须与 `EpisodeFrame.jointPositions / actionPositions` 的下标对齐，这是应用层的责任。

---

## 7. 性能设计一览

SDK 的所有性能优化围绕一个原则：**让 React 只做低频状态刷新，把高频驱动留给命令式渲染路径**。

| 问题 | 方案 |
|---|---|
| rAF 时钟不应引起 60fps React 重渲 | `throttle` 参数节流 `onStateChange`，默认每 3 帧通知一次 |
| 3D 姿态每帧更新，走 React 太慢 | `currentTimeRef` 直读 + R3F `useFrame`，完全绕过 React |
| 多路视频时间漂移 | `useVideoChannel` 高频检测 `currentTime` 偏差并纠偏 |
| 大数据集图表卡顿 | `downsampleColumnar` 将帧数压缩至 ≤1500 点 |
| uPlot 系列显隐切换 | `prevSeriesShowRef` diff，仅对变化的 series 调用 `setSeries` |
| URDF Mesh 重复加载 | STL geometry 按 `(path, authToken)` 缓存 `Promise<BufferGeometry>` |
| 回调进入 useEffect deps 触发重加载 | 所有外部 callback 以 ref 持有，不进入 deps 数组 |
| 后台标签页返回时时钟跳帧 | `visibilitychange` 重置 `_lastTimestamp`，丢弃累积 delta |

---

## 8. 使用示例

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
} from '@lerobot/player'

interface EpisodePlayerProps {
  frames: EpisodeFrame[]
  videoUrls: Record<string, string>
  urdf: UrdfConfig
  fps: number
}

export function EpisodePlayer({ frames, videoUrls, urdf, fps }: EpisodePlayerProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  // Episode 切换时销毁重建时钟
  const clock = useMemo(
    () => new PlaybackClock({ totalFrames: frames.length, fps }),
    [frames.length, fps],
  )
  useEffect(() => () => clock.destroy(), [clock])

  return (
    <PanelGridProvider value={gridRef}>
      <PlayerProvider clock={clock}>
        <div ref={gridRef} className="relative grid grid-cols-3 gap-2 h-full p-2">
          {Object.entries(videoUrls).map(([key, src]) => (
            <VideoPanel key={key} topicKey={key} src={src} fps={fps} />
          ))}
          <JointCurvesPanel
            frames={frames}
            jointNames={urdf.jointNames}
            fps={fps}
            totalFrames={frames.length}
            isLoading={false}
          />
          <RobotViewerPanel
            frames={frames}
            jointNames={urdf.jointNames}
            urdf={urdf}
          />
          <FrameInspectorPanel frames={frames} jointNames={urdf.jointNames} />
        </div>
        <PlaybackControls totalFrames={frames.length} fps={fps} />
      </PlayerProvider>
    </PanelGridProvider>
  )
}
```

---

## 9. 扩展方向

| 场景 | 扩展点 |
|---|---|
| 新增数据面板（点云、力矩、触觉等） | 用 `useSubscribe` 消费高频时钟 + `PanelShell` 包裹，无需触碰 Core |
| 多 Episode 同屏对比 | 创建多个 `PlaybackClock` 实例，嵌套多个 `PlayerProvider` |
| 帧缩略图时间轴 | 通过 `PlaybackControls` 的 `strip` prop 注入自定义内容 |
| 自定义倍速档位 | 目前硬编码于 `PlaybackControls`，可提为 prop |
| 键盘快捷键、循环播放 | 应用层监听键盘事件调用 `usePlayerActions`，或包一层 Provider 封装策略 |
| SSR / Next.js | Core 已做 `typeof document` 守卫，UI 组件加 `'use client'` 指令 |
| Electron 桌面客户端 | Core 无浏览器专属 API，可直接在渲染进程复用；视频 `src` 支持 `file://` 或自定义协议 |
