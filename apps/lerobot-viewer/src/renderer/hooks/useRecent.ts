import { useCallback, useEffect, useState } from 'react'
import type { RecentEntry } from '../../preload/index'

export function useRecent() {
  const [recent, setRecent] = useState<RecentEntry[]>([])

  const refresh = useCallback(async () => {
    setRecent(await window.lerobot.listRecent())
  }, [])

  const clear = useCallback(async () => {
    await window.lerobot.clearRecent()
    setRecent([])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { recent, refresh, clear }
}
