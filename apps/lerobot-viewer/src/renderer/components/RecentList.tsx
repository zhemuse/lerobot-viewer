import { useMemo, useState } from 'react'
import { Folder, Search } from 'lucide-react'
import type { RecentEntry } from '../../preload/index'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day} 天前`
  if (day < 30) return `${Math.floor(day / 7)} 周前`
  return `${Math.floor(day / 30)} 月前`
}

function shortenPath(p: string, maxLen = 56): string {
  if (p.length <= maxLen) return p
  const head = p.slice(0, Math.floor(maxLen / 2) - 1)
  const tail = p.slice(-Math.floor(maxLen / 2) + 1)
  return `${head}…${tail}`
}

interface RecentListProps {
  entries: RecentEntry[]
  onOpen: (path: string) => Promise<boolean>
  onRefresh: () => Promise<void>
}

export function RecentList({ entries, onOpen, onRefresh }: RecentListProps) {
  const [errorPath, setErrorPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const showFilter = entries.length > 5

  const filtered = useMemo(() => {
    if (!query.trim()) return entries
    const q = query.toLowerCase()
    return entries.filter(
      (e) => e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q),
    )
  }, [entries, query])

  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[18px] font-semibold text-[var(--ink)]">最近打开</h2>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-panel)] overflow-hidden">
        {showFilter && (
          <div className="px-5 pt-5 pb-4 flex flex-col gap-1.5">
            <label htmlFor="recent-filter" className="text-[12px] text-[var(--ink-muted)]">
              名称
            </label>
            <div className="flex items-center gap-2 h-9 max-w-md px-3 rounded-md border border-[var(--border)] focus-within:border-[var(--accent)] transition-colors">
              <Search size={14} className="text-[var(--ink-subtle)] shrink-0" />
              <input
                id="recent-filter"
                type="text"
                placeholder="按名称筛选"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-subtle)] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-[220px_1fr_110px] px-5 h-10 items-center text-[11px] font-medium text-[var(--ink-muted)] border-b border-[var(--border)]">
          <span>名称</span>
          <span>路径</span>
          <span className="text-right">最后打开</span>
        </div>
        <div className="flex flex-col">
          {filtered.map((e, idx) => (
            <button
              key={e.path}
              type="button"
              title={e.path}
              onClick={async () => {
                setErrorPath(null)
                const ok = await onOpen(e.path)
                if (!ok) {
                  setErrorPath(e.path)
                  await onRefresh()
                }
              }}
              className={[
                'grid grid-cols-[220px_1fr_110px] px-5 h-12 items-center text-left hover:bg-[var(--bg-hover)] transition-colors',
                idx > 0 ? 'border-t border-[var(--border-subtle)]' : '',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <Folder size={14} className="text-[var(--accent)] shrink-0" />
                <span className="text-[13px] text-[var(--ink)] truncate">{e.name}</span>
              </div>
              <span className="font-mono text-[12px] text-[var(--ink-subtle)] truncate pr-4">
                {shortenPath(e.path)}
              </span>
              <span className="text-[12px] text-[var(--ink-muted)] text-right">
                {relativeTime(e.lastOpenedAt)}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 h-12 flex items-center text-[12px] text-[var(--ink-subtle)]">
              无匹配结果
            </div>
          )}
        </div>
      </div>

      {errorPath && (
        <p className="text-[11px] text-[var(--danger)]">目录已不存在，已从列表移除</p>
      )}
    </div>
  )
}
