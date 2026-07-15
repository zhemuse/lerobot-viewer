import { useEffect } from 'react'
import { usePlayerActions, usePlayerState } from '@lerobot/player'

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    el.isContentEditable === true
  )
}

interface GlobalHandlers {
  openDataset: () => void
  openUrdf: () => void
}

export function useGlobalShortcuts({ openDataset, openUrdf }: GlobalHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'o' && !e.shiftKey) {
        e.preventDefault()
        openDataset()
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        openUrdf()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openDataset, openUrdf])
}

export function useTransportShortcuts() {
  const { isPlaying, currentFrame } = usePlayerState()
  const { play, pause, seek } = usePlayerActions()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return
      if (e.key === ' ') {
        e.preventDefault()
        isPlaying ? pause() : play()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        seek(currentFrame - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        seek(currentFrame + 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPlaying, currentFrame, play, pause, seek])
}
