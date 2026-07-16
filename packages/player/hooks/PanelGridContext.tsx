'use client'
import { createContext, type RefObject, useContext } from 'react'

const PanelGridContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

export const PanelGridProvider = PanelGridContext.Provider

export function usePanelGridRef() {
  return useContext(PanelGridContext)
}
