import { useDataset } from './hooks/useDataset'
import { TopBar } from './components/TopBar'
import { PanelLayout } from './components/PanelLayout'
import { UIStateProvider, useUIState } from './state/UIState'
import { Sidebar } from './components/Sidebar'
import { useGlobalShortcuts } from './hooks/useShortcuts'

export function App() {
  return (
    <UIStateProvider>
      <AppInner />
    </UIStateProvider>
  )
}

function AppInner() {
  const {
    meta, datasetPath, frames, selectedEpisode, urdfUrl, loading,
    openDataset, openRecentPath, selectEpisode, clearEpisode, openUrdf,
  } = useDataset()
  const { sidebarCollapsed } = useUIState()

  // 未打开数据集时隐藏侧栏
  const hasContent = (meta?.episodes.length ?? 0) > 0
  const showSidebar = hasContent && !sidebarCollapsed

  return (
    <>
      <AppShortcuts openDataset={openDataset} openUrdf={openUrdf} />
      <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
        <TopBar
          datasetPath={datasetPath}
          datasetMeta={meta}
          selectedEpisode={selectedEpisode}
          onGoHome={clearEpisode}
          onSelectEpisode={selectEpisode}
        />

        <div className="flex flex-1 overflow-hidden">
          {showSidebar && (
            <Sidebar
              meta={meta}
              episodes={meta?.episodes ?? []}
              selectedEpisode={selectedEpisode}
              onSelectEpisode={selectEpisode}
              fps={meta?.fps ?? 30}
            />
          )}

          {/* 主内容区 */}
          <div className="flex-1 overflow-hidden relative">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm text-sm text-[var(--ink)]">
                加载中…
              </div>
            )}
            <PanelLayout
              frames={frames}
              cameraNames={meta?.cameraNames ?? []}
              jointNames={meta?.jointNames ?? []}
              fps={meta?.fps ?? 30}
              selectedEpisode={selectedEpisode}
              urdfUrl={urdfUrl}
              onOpenDataset={openDataset}
              onOpenUrdf={openUrdf}
              onOpenRecent={openRecentPath}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function AppShortcuts({
  openDataset,
  openUrdf,
}: {
  openDataset: () => void
  openUrdf: () => void
}) {
  useGlobalShortcuts({ openDataset, openUrdf })
  return null
}
