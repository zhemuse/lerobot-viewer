# Refactoring Plan (trimmed)

**[中文](REFACTORING.zh-CN.md) | English**


This document records the architectural work planned after P0. The plan
started as a VSCode-style overhaul; on reflection it was overkill for a
project this size, so we cut it back to three focused pieces that pay for
their own complexity.

**Read first**: `packages/player/DESIGN.md` describes the current implementation; this document describes the **target state**.

---

## 0. Guiding principles (trimmed)

| Principle | Notes |
|---|---|
| Long-lived resources are disposable | Anything with a listener, timer, IPC binding, or GPU handle implements `IDisposable`; a `DisposableStore` releases them in bulk. |
| Prefer native platform primitives | `AbortSignal` for cancellation, plain callbacks or `eventemitter3` if a true pub/sub is ever needed. Do not reinvent VSCode's `Emitter<T>`. |
| Typed process boundaries | IPC main↔preload↔renderer share a single TypeScript interface so signature drift breaks the build. |
| Kill module-level mutable globals in main | Every mutable piece of main-process state (dataset root, current episode) belongs on a `WindowContext` instance so multi-window works. |
| React stays React | Do not build a DI-lite service layer or ServicesProvider in the renderer. Hooks + Context are fine at this size. |

---

## 1. What we're actually doing

### 1.1 Disposable primitive (DONE)

`packages/player/base/lifecycle.ts` — the only base primitive we keep. Used by
long-lived objects that own subscriptions (main-process IPC controllers,
protocol handlers, window contexts, later maybe an STL cache).

```ts
export interface IDisposable { dispose(): void }
export class DisposableStore implements IDisposable { add/delete/clear/dispose }
export abstract class Disposable { protected _register<T>(d: T): T }
export function toDisposable(fn: () => void): IDisposable
export function combinedDisposable(...ds: IDisposable[]): IDisposable
```

Exported as `@lerobot-viewer/player/base`. Covered by 12 unit tests.

### 1.2 Electron main OOP rewrite (task #29)

Kill module-level globals in `apps/lerobot-viewer/src/main/**` by putting
them on classes owned by a top-level `MainApplication`.

```
apps/lerobot-viewer/src/main/
├── application/MainApplication.ts   ← top-level: new MainApplication().start()
├── window/WindowContext.ts          ← per-BrowserWindow state (datasetRoot / urdfRoot)
├── protocol/LerobotProtocolHandler.ts
├── ipc/DatasetIpcController.ts
└── services/RecentDatasetService.ts
```

Everything is a `Disposable`; `MainApplication` owns a `DisposableStore` that
tears down cleanly. Solves the "module-level `let datasetRoot`" bug and
unlocks multi-window (#15).

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

// main/index.ts becomes 6 lines
new MainApplication().start().catch((err) => { console.error(err); app.quit() })
```

### 1.3 Typed IPC contract (task #30)

Shared TypeScript interface consumed by both main and preload so signature
drift is a compile error. Not a full RPC framework — just a contract file.

```ts
// apps/lerobot-viewer/src/shared/contract.ts — imported by both sides
export interface LerobotBridge {
  openDataset(): Promise<DatasetOpenResult | null>
  loadEpisode(idx: number, signal?: AbortSignal): Promise<EpisodeFrame[]>
  openUrdf(): Promise<string | null>
  listRecent(): Promise<RecentEntry[]>
  openRecent(path: string): Promise<DatasetOpenResult | null>
  clearRecent(): Promise<void>
  resolveVideoUrl(relativePath: string): string
}

// preload implements it and calls contextBridge.exposeInMainWorld('lerobot', impl)
// main's ipc handlers type-check against the same interface's return types
```

No runtime proxy, no channel server/client, no zod schema. Add validation only
when we actually route untrusted input.

### 1.4 DatasetSource abstraction (task #28)

Extract the reader into a light OOP layer that will later support
HuggingFace Hub / HTTP sources.

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
  async meta() { /* logic moved from meta.ts */ }
  async frames(episode, signal) { /* logic moved from parquet.ts + honor signal */ }
  videoUrl(episode, camera) { return `lerobot://videos/observation.images.${camera}/episode_${pad6(episode)}.mp4` }
}

// packages/reader/src/index.ts — back-compat shim
export function readDatasetMeta(path: string): Promise<DatasetMeta> {
  return new LocalDatasetSource(path).meta()
}
export function readEpisodeFrames(path: string, episode: number, signal?: AbortSignal): Promise<EpisodeFrame[]> {
  return new LocalDatasetSource(path).frames(episode, signal)
}
```

`AbortSignal` (native) instead of a custom `CancellationToken` — fixes the
"user opens B while A still loading" race in `useDataset` (#14) without
inventing new types.

---

## 2. Explicitly cut from the plan

These were in an earlier draft; they don't pay their complexity for a project
this size. Bring them back only if the trigger listed actually happens.

| Cut | Bring back when… |
|---|---|
| `Emitter<T>` / `Event<T>` + combinators | 3+ services need to cross-communicate. Until then use callbacks or drop in `eventemitter3` on the day you need it (5 min swap). |
| `CancellationToken` | Never — `AbortSignal` is native and does the same job. |
| DI-lite service layer + `ServicesProvider` | You want to run the renderer logic outside React (SSR, tests without JSDOM). Not on the roadmap. |
| `PanelRegistry` (pluggable panels) | You want a third-party extension SDK, or user-configurable layouts. Currently 4 hardcoded panels — a `switch` is fine. |
| `CommandRegistry` + `KeybindingRegistry` | You add a command palette (Cmd+K). Currently ~3 shortcuts wired directly. |
| `LayoutService` (external fullscreen state) | You need "only one panel maximized globally" enforced across the app. Currently local `useState` in `PanelShell` is fine. |

---

## 3. Migration order (3 tasks)

| # | Task | Depends on | Blast radius | Breaks callers? |
|---|------|------------|--------------|-----------------|
| 23 | `Disposable` / `DisposableStore` (DONE) | — | new files | no |
| 28 | `DatasetSource` + `LocalDatasetSource` shim | 23 | `packages/reader/` internal; shim keeps old exports | no |
| 29 | Main OOP rewrite (per-window context, Disposable-owned) | 23, 28 | `apps/lerobot-viewer/src/main/**` | ⚠️ atomic commit |
| 30 | Typed IPC contract file | 29 | `apps/lerobot-viewer/src/{main,preload,shared}` | ⚠️ contract change requires both sides |

**Suggested PR split**:
- PR-1: 23 (DONE — Disposable + tests)
- PR-2: 28 (reader abstraction, back-compat shim keeps app untouched)
- PR-3: 29 + 30 (main rewrite + contract — one atomic PR)

That's it. Three deliberate pieces instead of nine.

---

## 4. Definition of done

After the three tasks land:

- Opening a second window works without state bleed between windows.
- Data loading race (open B while A is loading) can't leak stale frames into the UI.
- Adding a HuggingFace Hub source is a new subclass, no app changes.
- Adding an IPC method that main forgets to implement is a compile error, not a runtime "undefined is not a function".
- Main process cleanly disposes on `app.quit()` — no dangling listeners.

If a future need justifies bringing back one of the cut items, it slots on top
of `Disposable` cleanly. But we don't build for hypothetical needs.
