import { FolderOpen, Box } from 'lucide-react'
import { useRecent } from '../hooks/useRecent'
import { RecentList } from './RecentList'

interface WelcomeScreenProps {
  onOpenDataset: () => void
  onOpenUrdf: () => void
  onOpenRecent: (path: string) => Promise<boolean>
}

interface DashboardCardProps {
  icon: React.ReactNode
  title: string
  description: string
  shortcut?: string
  onClick: () => void
}

function DashboardCard({ icon, title, description, shortcut, onClick }: DashboardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <span className="text-[var(--accent)] shrink-0">{icon}</span>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[var(--ink)]">{title}</span>
          {shortcut && (
            <span className="text-[11px] font-mono text-[var(--ink-subtle)]">{shortcut}</span>
          )}
        </div>
        <p className="text-[13px] text-[var(--ink-muted)] leading-relaxed">{description}</p>
      </div>
    </button>
  )
}

export function WelcomeScreen({ onOpenDataset, onOpenUrdf, onOpenRecent }: WelcomeScreenProps) {
  const { recent, refresh } = useRecent()

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-5xl px-10 py-10 flex flex-col gap-8">
        <h1 className="text-[24px] font-bold text-[var(--ink)]">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DashboardCard
            icon={<FolderOpen size={22} strokeWidth={1.75} />}
            title="打开数据集"
            shortcut="⌘O"
            description="从本地目录加载 LeRobot 格式数据集，包含视频、关节和元数据。"
            onClick={onOpenDataset}
          />
          <DashboardCard
            icon={<Box size={22} strokeWidth={1.75} />}
            title="加载 URDF 模型"
            shortcut="⌘⇧U"
            description="导入机器人 URDF 描述，与数据集回放同步显示 3D 姿态。"
            onClick={onOpenUrdf}
          />
        </div>

        {recent.length > 0 && (
          <RecentList entries={recent} onOpen={onOpenRecent} onRefresh={refresh} />
        )}
      </div>
    </div>
  )
}
