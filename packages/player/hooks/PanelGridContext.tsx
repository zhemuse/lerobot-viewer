'use client'
import { createContext, useContext, type RefObject } from 'react'

const PanelGridContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const PanelGridProvider = PanelGridContext.Provider

export function usePanelGridRef() {
  return useContext(PanelGridContext)
}
