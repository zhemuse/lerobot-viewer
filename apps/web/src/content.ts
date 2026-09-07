export const links = {
  github: 'https://github.com/zhemuse/lerobot-viewer',
  releases: 'https://github.com/zhemuse/lerobot-viewer/releases',
}

/** Order and mono labels are language-neutral; the prose lives in `translations` below. */
export const features = [
  { id: 'sync', label: '01 / ALIGN' },
  { id: 'trace', label: '02 / INSPECT' },
  { id: 'replay', label: '03 / REPLAY' },
  { id: 'quality', label: '04 / DIAGNOSE' },
] as const

export type FeatureId = (typeof features)[number]['id']

export const languages = ['zh', 'en'] as const

export type Language = (typeof languages)[number]

export const defaultLanguage: Language = 'zh'

export const languageStorageKey = 'lerobot-viewer.lang'

/** Label shown on the switcher — always the language you are currently reading. */
export const languageLabels: Record<Language, string> = {
  zh: '中文',
  en: 'English',
}

/** Two-part headline: rendered as `{a}<br /><em>{b}</em>`, where `b` gets the outlined type. */
type Headline = {
  a: string
  b: string
}

type Translation = {
  heroHeadline: Headline
  heroLede: string
  manifesto: { headline: Headline; body: string }
  features: { headline: Headline; intro: string[]; items: Record<FeatureId, Headline> }
  loop: { headline: Headline; body: string }
  buttons: { download: string; downloadApp: string; downloadClient: string; source: string }
  release: { latest: string; viewAll: string }
  nav: { capabilities: string; howItWorks: string; github: string }
  a11y: { mockup: string; scrub: string; switchLanguage: string }
}

export const translations: Record<Language, Translation> = {
  zh: {
    heroHeadline: { a: '让每一帧', b: '都值得被看见' },
    heroLede:
      'LeRobot 的桌面端数据工具。一键浏览本地与 Hugging Face 上的数据集，多模态同步播放、轨迹分析、3D 实时回放与 AI 质量诊断，尽在一处。',
    manifesto: {
      headline: { a: 'LeRobot 数据不该', b: '只存在于文件夹里。' },
      body: '打开一个目录。看见一个 episode。理解一次动作。',
    },
    features: {
      headline: { a: '四种方式，', b: '看懂你的数据。' },
      intro: ['从本地 Parquet 与视频目录出发，', '为 LeRobot 的数据形状而生。'],
      items: {
        sync: {
          a: '多模态同步播放',
          b: '视频、action 与 state 在统一时间轴上帧级对齐，拖动即所见。',
        },
        trace: {
          a: 'Action / State 轨迹分析',
          b: '按关节叠加曲线，定位跟踪偏差、异常区间与执行误差。',
        },
        replay: {
          a: '3D 机器人实时回放',
          b: '加载 URDF，逐帧重演关节姿态，观察末端执行器运动轨迹。',
        },
        quality: {
          a: 'AI 数据质量诊断',
          b: '发现动作抖动、相机遮挡、帧同步偏移与信号丢失。',
        },
      },
    },
    loop: {
      headline: { a: '把数据变成', b: '清晰的下一步' },
      body: '发现问题、定位问题、修复问题。LeRobot Viewer 让每次训练前的数据审查，都从猜测变成证据。',
    },
    buttons: {
      download: '下载',
      downloadApp: '下载应用',
      downloadClient: '下载客户端',
      source: '查看源码',
    },
    release: { latest: '最新', viewAll: '查看全部版本' },
    nav: { capabilities: '核心能力', howItWorks: '如何使用', github: 'GitHub' },
    a11y: {
      mockup: 'LeRobot Viewer 播放器预览',
      scrub: '移动预览帧',
      switchLanguage: '切换到 English',
    },
  },
  en: {
    heroHeadline: { a: 'Every frame', b: 'deserves to be seen' },
    heroLede:
      'A desktop data tool for LeRobot. Browse local and Hugging Face datasets in one click — synchronized multimodal playback, trajectory analysis, live 3D replay and AI quality diagnostics, all in one place.',
    manifesto: {
      headline: { a: "LeRobot data shouldn't", b: 'just sit in a folder.' },
      body: 'Open a directory. See an episode. Understand an action.',
    },
    features: {
      headline: { a: 'Four ways to read', b: 'what your robot did.' },
      intro: [
        'Built on local Parquet and video directories,',
        'shaped around how LeRobot stores data.',
      ],
      items: {
        sync: {
          a: 'Synchronized multimodal playback',
          b: 'Video, action and state aligned frame by frame on a single timeline. Scrub and see it.',
        },
        trace: {
          a: 'Action / state trajectory analysis',
          b: 'Overlay curves per joint to locate tracking drift, anomalous spans and execution error.',
        },
        replay: {
          a: 'Live 3D robot replay',
          b: 'Load a URDF, replay joint poses frame by frame, and watch the end-effector path.',
        },
        quality: {
          a: 'AI data quality diagnostics',
          b: 'Surface jitter, camera occlusion, frame desync and dropped signals.',
        },
      },
    },
    loop: {
      headline: { a: 'Turn data into', b: 'a clear next step' },
      body: 'Find the problem, locate it, fix it. LeRobot Viewer turns the data review before every training run from guesswork into evidence.',
    },
    buttons: {
      download: 'DOWNLOAD',
      downloadApp: 'DOWNLOAD THE APP',
      downloadClient: 'DOWNLOAD CLIENT',
      source: 'VIEW SOURCE',
    },
    release: { latest: 'Latest', viewAll: 'All releases' },
    nav: { capabilities: 'CAPABILITIES', howItWorks: 'HOW IT WORKS', github: 'GITHUB' },
    a11y: {
      mockup: 'LeRobot Viewer playback preview',
      scrub: 'Move the preview frame',
      switchLanguage: '切换到中文',
    },
  },
}

/** Reads the stored choice, falling back to Chinese for first-time visitors. */
export function readStoredLanguage(): Language {
  if (typeof localStorage === 'undefined') return defaultLanguage
  const stored = localStorage.getItem(languageStorageKey)
  return languages.includes(stored as Language) ? (stored as Language) : defaultLanguage
}

export function otherLanguage(current: Language): Language {
  return current === 'zh' ? 'en' : 'zh'
}
