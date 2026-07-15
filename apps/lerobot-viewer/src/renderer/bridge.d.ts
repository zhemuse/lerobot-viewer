import type { LerobotBridge } from '../preload/index'

declare global {
  interface Window {
    lerobot: LerobotBridge
  }
}
