# LeRobot Viewer

**中文 | [English](README.md)**

用于本地可视化 [LeRobot](https://github.com/huggingface/lerobot) 数据集的桌面应用。多相机视频、关节 state / action 曲线、URDF 驱动的 3D 机器人——一切在本地，无需服务器。

![核心能力](assets/features.png)

## 为什么造这个

已经在用 [Foxglove Studio](https://foxglove.dev/) 或 [Rerun](https://rerun.io/) 的话你就懂这个赛道了。LeRobot Viewer 的定位更窄：**专门为 Hugging Face LeRobot 数据集**这个具体形态服务，只做这类数据最需要的那几件事。

- **Foxglove Studio**：通用机器人栈，MCAP 原生，插件生态。你要的只是一个 LeRobot Parquet + 视频目录时它太重了。
- **Rerun**：优秀的时序数据 viewer，但你需要用它的 SDK 主动 log 数据。LeRobot Viewer 直接读磁盘格式。
- **LeRobot Viewer**：为 LeRobot 的确切目录结构（`meta/info.json` + `data/chunk-*/…parquet` + `videos/…/*.mp4`）优化。选个文件夹，即刻可视化。

## 功能

### 多模态数据同步回放
多相机视频、action、state 在同一时间轴上帧对齐。拖动、逐帧检视遥操作数据。

### Action / State 轨迹分析
逐关节叠加对比 action 与 state 曲线。交互 tooltip；图表内点击可 seek；关节筛选。

### 3D 机器人回放
载入 URDF 后在 3D 视口中实时重演关节姿态。悬停 link 可查看父关节 / 质量元数据。

## 包结构

| 包 | 说明 |
|----|------|
| [`@lerobot-viewer/player`](./packages/player) | React + Three.js 多模态回放 SDK |
| [`@lerobot-viewer/reader`](./packages/reader) | Node.js LeRobot Parquet 解析器 |

两个包可独立消费——如果你自己能构造 `EpisodeFrame[]`，可以只用 `@lerobot-viewer/player` 集成到自己的 web 应用里。

## 环境要求

- Node.js ≥ 20
- pnpm ≥ 9

## 快速开始

```bash
git clone https://github.com/zhemuse/lerobot-viewer.git
cd lerobot-viewer
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build           # 为当前平台构建桌面 app
pnpm build:packages  # 构建两个 npm 包
pnpm typecheck
pnpm test
pnpm lint
```

## 项目结构

```
lerobot-viewer/
├── apps/
│   └── lerobot-viewer/    # Electron 桌面应用
└── packages/
    ├── player/            # @lerobot-viewer/player
    └── reader/            # @lerobot-viewer/reader
```

## Roadmap

- HuggingFace Hub 数据源（不必先克隆到本地）
- 多窗口数据集对比
- 自动化数据质量报告（动作抖动、相机遮挡、同步偏移、信号丢失）
- macOS / Windows / Linux 签名发布 + 自动更新

## 许可证

MIT
