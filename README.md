# LeRobot Viewer

**[中文](README.zh-CN.md) | English**

A desktop application for visualizing [LeRobot](https://github.com/huggingface/lerobot) datasets locally. Inspect robot episodes with synchronized video playback, joint curves, and 3D robot visualization — all from local files, no server required.

## Features

![Core capabilities](assets/features.png)

### Multi-modal synchronized playback
Multi-camera video, action and state signals aligned frame-by-frame on a single timeline. Drag to scrub; inspect teleoperation data frame-by-frame without guessing.

### Action / State trajectory analysis
Overlay action vs. state curves per joint. Deviation and anomaly regions are highlighted automatically, making it easy to pinpoint segments where execution fell short.

### 3D robot playback · end-effector trajectory
Load a URDF and replay every joint pose in real time inside a 3D viewport. The end-effector trajectory is fully visible; inspect motion quality from any angle.

### AI data quality analysis
AI scores every episode automatically, detecting motion jitter, camera occlusion, frame-sync drift, and signal loss — so you can clean bad data before training.

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
