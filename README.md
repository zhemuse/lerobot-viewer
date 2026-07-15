# LeRobot Viewer

A desktop application for visualizing [LeRobot](https://github.com/huggingface/lerobot) datasets locally. Inspect robot episodes with synchronized video playback, joint curves, and 3D robot visualization — all from local files, no server required.

## Features

- Open any LeRobot-format dataset directory
- Synchronized multi-camera video playback
- Joint position / action curves (uPlot)
- 3D robot visualization with URDF support
- Recent datasets list

## Packages

| Package | Description |
|---------|-------------|
| [`@lerobot/player`](./packages/player) | React + Three.js multimodal playback SDK |
| [`@lerobot/lerobot-reader`](./packages/lerobot-reader) | Node.js Parquet reader for LeRobot datasets |

## Requirements

- Node.js >= 20
- pnpm >= 9

## Getting Started

```bash
git clone https://github.com/zhemuse/lerobot-viewer.git
cd lerobot-viewer
pnpm install
pnpm dev
```

## Build

```bash
pnpm build      # build for current platform
```

## Project Structure

```
lerobot-viewer/
├── apps/
│   └── lerobot-viewer/    # Electron desktop app
└── packages/
    ├── player/            # @lerobot/player
    └── lerobot-reader/    # @lerobot/lerobot-reader
```

## License

MIT
