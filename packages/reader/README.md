# @lerobot-viewer/reader

Node.js reader for [LeRobot](https://github.com/huggingface/lerobot) datasets. Parses `meta/info.json` + `meta/episodes.jsonl` + per-episode Parquet files into typed objects your app can hand straight to [`@lerobot-viewer/player`](https://www.npmjs.com/package/@lerobot-viewer/player).

## Install

```bash
npm install @lerobot-viewer/reader
```

Node ≥ 20. Runs in the Electron main process or in a plain Node script.

## Usage

### Class-based (recommended)

```ts
import { LocalDatasetSource } from '@lerobot-viewer/reader'

const source = new LocalDatasetSource('/path/to/dataset')

const meta = await source.meta()
// {
//   fps, totalEpisodes, jointNames, cameraNames,
//   episodes: [{ episodeIndex, length, task? }, …]
// }

const frames = await source.frames(0)               // load episode 0
const url = source.videoUrl(0, 'top_rgb')           // 'lerobot://…'
```

`frames()` accepts an optional `AbortSignal` — pair it with an `AbortController` if the user might switch datasets mid-load:

```ts
const ctrl = new AbortController()
const frames = await source.frames(3, ctrl.signal)
// ctrl.abort() to cancel
```

### Extending

`DatasetSource` is an abstract base. Add a new backend (HuggingFace Hub, HTTP mirror, S3, …) by subclassing:

```ts
import { DatasetSource, type DatasetMeta, type EpisodeFrame } from '@lerobot-viewer/reader'

export class HubDatasetSource extends DatasetSource {
  readonly id: string
  constructor(private readonly repo: string) { super(); this.id = `hub:${repo}` }
  async meta() { /* fetch from HF Hub */ }
  async frames(episodeIndex: number, signal?: AbortSignal) { /* fetch Parquet from Hub */ }
  videoUrl(episodeIndex: number, camera: string) { return `https://huggingface.co/…` }
}
```

### Legacy functional API

Kept for back-compat — new code should prefer `LocalDatasetSource`.

```ts
import { readDatasetMeta, readEpisodeFrames } from '@lerobot-viewer/reader'

const meta = await readDatasetMeta('/path/to/dataset')
const frames = await readEpisodeFrames('/path/to/dataset', 0)
```

## License

MIT
