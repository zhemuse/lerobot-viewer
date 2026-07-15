# LeRobot Viewer

**中文 | [English](README.md)**

用于本地可视化 [LeRobot](https://github.com/huggingface/lerobot) 数据集的桌面应用。同步回放多路摄像头视频、关节曲线与 3D 机器人模型——无需服务器，所有数据均在本地处理。

## 功能

- 打开任意 LeRobot 格式数据集目录
- 多路摄像头视频同步播放
- 关节位置 / 控制动作曲线（uPlot）
- 基于 URDF 的 3D 机器人可视化
- 最近打开的数据集列表

## 包结构

| 包 | 说明 |
|----|------|
| [`@lerobot/player`](./packages/player) | React + Three.js 多模态回放 SDK |
| [`@lerobot/lerobot-reader`](./packages/lerobot-reader) | Node.js LeRobot Parquet 解析器 |

## 环境要求

- Node.js >= 20
- pnpm >= 9

## 快速开始

```bash
git clone https://github.com/zhemuse/lerobot-viewer.git
cd lerobot-viewer
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build      # 为当前平台构建安装包
```

## 项目结构

```
lerobot-viewer/
├── apps/
│   └── lerobot-viewer/    # Electron 桌面应用
└── packages/
    ├── player/            # @lerobot/player
    └── lerobot-reader/    # @lerobot/lerobot-reader
```

## 许可证

MIT
