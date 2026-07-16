import { createContext, type ReactNode, useContext, useReducer } from 'react'

export interface UIStateShape {
  sidebarWidth: number
  sidebarCollapsed: boolean
}

export type UIAction =
  | { type: 'setSidebarWidth'; width: number }
  | { type: 'toggleSidebar' }
  | { type: 'setSidebarCollapsed'; value: boolean }

const initialState: UIStateShape = {
  sidebarWidth: 240,
  sidebarCollapsed: false,
}

function reducer(state: UIStateShape, action: UIAction): UIStateShape {
  switch (action.type) {
    case 'setSidebarWidth':
      return { ...state, sidebarWidth: Math.max(200, Math.min(360, action.width)) }
    case 'toggleSidebar':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed }
    case 'setSidebarCollapsed':
      return { ...state, sidebarCollapsed: action.value }
  }
}

const StateCtx = createContext<UIStateShape | null>(null)
const DispatchCtx = createContext<((action: UIAction) => void) | null>(null)

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useUIState(): UIStateShape {
  const v = useContext(StateCtx)
  if (!v) throw new Error('useUIState must be inside UIStateProvider')
  return v
}

export function useUIDispatch(): (action: UIAction) => void {
  const v = useContext(DispatchCtx)
  if (!v) throw new Error('useUIDispatch must be inside UIStateProvider')
  return v
}
