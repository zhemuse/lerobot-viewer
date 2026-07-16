import { PanelLayout } from './components/PanelLayout'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { useDataset } from './hooks/useDataset'
import { useGlobalShortcuts } from './hooks/useShortcuts'
import { UIStateProvider, useUIState } from './state/UIState'

export function App() {
  return (
    <UIStateProvider>
      <AppInner />
    </UIStateProvider>
  )
}

function AppInner() {
  const {
    meta,
    datasetPath,
    frames,
    selectedEpisode,
    urdfUrl,
    loading,
    error,
    openDataset,
    openRecentPath,
    selectEpisode,
    clearEpisode,
    openUrdf,
    dismissError,
  } = useDataset()
  const { sidebarCollapsed } = useUIState()

  // Hide the sidebar until a dataset is opened.
  const hasContent = (meta?.episodes.length ?? 0) > 0
  const showSidebar = hasContent && !sidebarCollapsed

  return (
    <>
      <AppShortcuts openDataset={openDataset} openUrdf={openUrdf} />
      <div className="flex flex-col h-screen bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
        {error && <ErrorBanner error={error} onDismiss={dismissError} />}
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

          <div className="flex-1 overflow-hidden relative">
            {loading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm text-sm text-[var(--ink)]">
                Loading…
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

function ErrorBanner({ error, onDismiss }: { error: Error; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 px-4 py-2 text-xs bg-red-600/90 text-white border-b border-red-800"
    >
      <span className="truncate">
        <span className="font-semibold mr-2">Error:</span>
        {error.message || String(error)}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 px-2 py-0.5 rounded hover:bg-white/15 transition-colors"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  )
}
