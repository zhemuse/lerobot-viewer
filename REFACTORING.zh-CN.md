# 重构方案（精简版）

**中文 | [English](REFACTORING.md)**

本文档记录 P0 完成后的架构工作。最初的方案是完整搬 VSCode 风格架构，复盘后判定：**对这个项目的体量而言过度设计**。因此砍到 3 个真正值得做的部分——每一项都能自证其复杂度。

**先读**：`packages/player/DESIGN.md` 是当前实现文档；本文档描述的是**目标态**。

---

## 0. 指导原则（精简版）

| 原则 | 说明 |
|---|---|
| 长生命周期资源必须可释放 | 任何带 listener、timer、IPC 绑定、GPU 句柄的对象都实现 `IDisposable`；`DisposableStore` 批量清理。 |
| 优先用平台原生基元 | `AbortSignal` 做取消；如果真需要发布订阅就用 `eventemitter3` |
| 进程边界必须有类型契约 | 主↔preload↔渲染共享同一份 TypeScript interface，签名漂移编译期就炸。 |
| 主进程消灭模块级可变全局 | 每一段可变主进程状态（datasetRoot、当前 episode 等）都挂在 `WindowContext` 实例上，多窗口才能跑。 |
| React 就是 React | 这个体量下，Hooks + Context 就是正解。 |

---

## 1. 我们真正要做的

### 1.1 Disposable 基元（已完成）

`packages/player/base/lifecycle.ts` —— 唯一保留的基础基元。给那些持有订阅的长生命周期对象用（主进程 IPC controller、协议 handler、window context，将来可能的 STL 缓存等）。

```ts
export interface IDisposable { dispose(): void }
export class DisposableStore implements IDisposable { add/delete/clear/dispose }
export abstract class Disposable { protected _register<T>(d: T): T }
export function toDisposable(fn: () => void): IDisposable
export function combinedDisposable(...ds: IDisposable[]): IDisposable
```

以 `@lerobot-viewer/player/base` subpath 导出，12 个单测覆盖。

### 1.2 Electron 主进程 OOP 化（任务 #29）

清除 `apps/lerobot-viewer/src/main/**` 里的模块级全局：把它们挂到由顶层 `MainApplication` 拥有的类实例上。

```
apps/lerobot-viewer/src/main/
├── application/MainApplication.ts   ← 顶层：new MainApplication().start()
├── window/WindowContext.ts          ← per-BrowserWindow 状态（datasetRoot / urdfRoot）
├── protocol/LerobotProtocolHandler.ts
├── ipc/DatasetIpcController.ts
└── services/RecentDatasetService.ts
```

所有类都是 `Disposable`；`MainApplication` 持有一个 `DisposableStore` 干净收工。修掉现在 "模块级 `let datasetRoot`" 的 bug，同时打开多窗口能力（#15）。

```ts
class MainApplication extends Disposable {
  private readonly recentSvc = this._register(new RecentDatasetService())
  private readonly windows = this._register(new WindowRegistry())
  private readonly protocolHandler = this._register(new LerobotProtocolHandler(this.windows))
  private readonly ipcController = this._register(new DatasetIpcController(this.windows, this.recentSvc))

  async start(): Promise<void> {
    protocol.registerSchemesAsPrivileged([...])
    await app.whenReady()
    this.protocolHandler.register()
    this.ipcController.register()
    this.createWindow()
  }
}

// main/index.ts 缩到 6 行
new MainApplication().start().catch((err) => { console.error(err); app.quit() })
```

### 1.3 类型化 IPC 契约（任务 #30）

主进程和 preload 共享同一份 TypeScript interface，签名漂移就是编译错。不做完整 RPC 框架——就一份契约文件。

```ts
// apps/lerobot-viewer/src/shared/contract.ts —— 两边都 import
export interface LerobotBridge {
  openDataset(): Promise<DatasetOpenResult | null>
  loadEpisode(idx: number, signal?: AbortSignal): Promise<EpisodeFrame[]>
  openUrdf(): Promise<string | null>
  listRecent(): Promise<RecentEntry[]>
  openRecent(path: string): Promise<DatasetOpenResult | null>
  clearRecent(): Promise<void>
  resolveVideoUrl(relativePath: string): string
}

// preload 实现它，然后 contextBridge.exposeInMainWorld('lerobot', impl)
// 主进程的 ipc handler 用同一份 interface 的返回类型做静态检查
```

不引入运行时代理，不搞 channel server/client，不加 zod。等真的需要处理不可信输入时再加校验。

### 1.4 DatasetSource 抽象（任务 #28）

把 reader 抽成轻量 OOP 层，为将来接 HuggingFace Hub / HTTP 数据源留口。

```ts
// packages/reader/src/source/DatasetSource.ts
abstract class DatasetSource {
  abstract meta(): Promise<DatasetMeta>
  abstract frames(episode: number, signal?: AbortSignal): Promise<EpisodeFrame[]>
  abstract videoUrl(episode: number, camera: string): string
}

// packages/reader/src/source/LocalDatasetSource.ts
class LocalDatasetSource extends DatasetSource {
  constructor(private readonly rootPath: string) { super() }
  async meta() { /* 迁移 meta.ts 逻辑 */ }
  async frames(episode, signal) { /* 迁移 parquet.ts + 尊重 signal */ }
  videoUrl(episode, camera) { return `lerobot://videos/observation.images.${camera}/episode_${pad6(episode)}.mp4` }
}

// packages/reader/src/index.ts —— 兼容 shim
export function readDatasetMeta(path: string): Promise<DatasetMeta> {
  return new LocalDatasetSource(path).meta()
}
export function readEpisodeFrames(path: string, episode: number, signal?: AbortSignal): Promise<EpisodeFrame[]> {
  return new LocalDatasetSource(path).frames(episode, signal)
}
```

用原生 `AbortSignal` 代替自造 `CancellationToken`——顺手修 `useDataset` 里"打开 B 时 A 还没加载完"的竞态（#14），不额外造新类型。

---

## 2. 明确从方案里砍掉的

以下都在早期草案里出现过；对这个项目的体量而言复杂度不划算。**只有下面的触发条件真的发生了，才把它们捡回来**。

| 砍掉的 | 什么时候捡回来 |
|---|---|
| `Emitter<T>` / `Event<T>` + 组合子 | 有 3 个以上的服务需要互相通信。在那之前用普通 callback；真需要的当天塞一个 `eventemitter3` 五分钟搞定。 |
| `CancellationToken` | 永远不。`AbortSignal` 是原生的，一样能干。 |
| DI-lite 服务层 + `ServicesProvider` | 你想让 renderer 逻辑脱离 React 跑（SSR、无 JSDOM 测试）。目前不在路线图上。 |
| `PanelRegistry`（面板贡献点） | 你想开放第三方扩展 SDK，或让用户可配置布局。当前 4 个硬编码面板——一个 `switch` 就够。 |
| `CommandRegistry` + `KeybindingRegistry` | 你要加命令面板（Cmd+K）。当前 3 个快捷键直接绑定就好。 |
| `LayoutService`（全屏状态外置） | 你要"全应用只允许一个面板同时全屏"这个跨面板约束。当前 `PanelShell` 内部 `useState` 够用。 |

---

## 3. 迁移顺序（3 个任务）

| # | 任务 | 依赖 | 影响面 | 是否破坏兼容 |
|---|------|------|--------|--------------|
| 23 | `Disposable` / `DisposableStore`（已完成） | — | 新增文件 | 否 |
| 28 | `DatasetSource` + `LocalDatasetSource` 兼容 shim | 23 | `packages/reader/` 内部；shim 保留旧导出 | 否 |
| 29 | 主进程 OOP 重写（per-window context、Disposable 管理） | 23、28 | `apps/lerobot-viewer/src/main/**` | ⚠️ 原子提交 |
| 30 | 类型化 IPC 契约文件 | 29 | `apps/lerobot-viewer/src/{main,preload,shared}` | ⚠️ 契约变更需两端同改 |

**建议 PR 拆分**：
- PR-1: 23（已完成——Disposable + 测试）
- PR-2: 28（reader 抽象；兼容 shim 让 app 层零改动）
- PR-3: 29 + 30（主进程重写 + 契约 —— 一次原子 PR）

就这三块。9 个任务砍到 3 个。

---

## 4. 完成信号

3 个任务落地后：

- 开第二个窗口不会出现窗口间的状态串扰。
- 数据加载竞态（A 加载中打开 B）不会把 A 的过期帧渲染到 UI。
- 加一个 HuggingFace Hub 数据源 = 加一个子类，app 层零改动。
- 加一个 IPC 方法但主进程忘了实现 = 编译错，而不是运行时 "undefined is not a function"。
- `app.quit()` 时主进程干净释放——无残留 listener。

将来如果某个真需求把砍掉的某一项召唤回来，它能干净地叠在 `Disposable` 之上。但我们不为假设的需求提前建设。
