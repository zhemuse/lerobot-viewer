# LeRobot Viewer

**中文 | [English](README.md)**

用于本地可视化 [LeRobot](https://github.com/huggingface/lerobot) 数据集的桌面应用。同步回放多路摄像头视频、关节曲线与 3D 机器人模型——无需服务器，所有数据均在本地处理。

## 功能

![四大核心能力](docs/assets/features.png)

### 多模态数据同步播放
多路相机视频、action 与 state 信号在统一时间轴上帧级对齐播放，拖动即所见，逐帧核对遥操作数据不再靠猜。

### Action / State 轨迹分析
逐关节叠加对比 action 与 state 曲线，自动高亮跟踪偏差与异常区间，快速定位执行不到位的片段。

### 3D 机器人实时回放 · 末端轨迹
加载 URDF 在 3D 视口中实时重演每一帧关节姿态，末端执行器轨迹全程可视，任意角度审视动作质量。

### AI 数据质量分析
AI 自动为每个 episode 打分，检测动作抖动、相机遮挡、帧同步偏移与信号丢失，训练前先清洗掉坏数据。

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
