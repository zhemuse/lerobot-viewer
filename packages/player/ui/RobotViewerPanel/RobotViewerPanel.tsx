'use client'
import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { type ComponentRef, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { EpisodeFrame, UrdfConfig } from '../../core/types'
import { usePlayerContext } from '../../hooks/PlayerProvider'
import { PanelShell } from '../PanelShell'
import SceneEnvironment from './SceneEnvironment'
import URDFRobotModel from './URDFRobot'

type RobotSize = { x: number; y: number; z: number }
type OrbitRef = React.RefObject<ComponentRef<typeof OrbitControls> | null>

function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  orbit: ComponentRef<typeof OrbitControls>,
  cx: number,
  cy: number,
  cz: number,
  sizeX: number,
  sizeY: number,
  padding = 1.2,
) {
  const fovY = (camera.fov * Math.PI) / 180
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect)
  const distY = sizeY / 2 / Math.tan(fovY / 2)
  const distX = sizeX / 2 / Math.tan(fovX / 2)
  const dist = Math.max(distY, distX) * padding
  camera.position.set(cx, cy, cz + dist)
  camera.updateProjectionMatrix()
  orbit.target.set(cx, cy, cz)
  orbit.update()
}

function useCameraAutoFit(robotSize: RobotSize | null, orbitRef: OrbitRef) {
  const { camera } = useThree()
  useEffect(() => {
    if (!robotSize || !(camera instanceof THREE.PerspectiveCamera) || !orbitRef.current) return
    fitCameraToBox(camera, orbitRef.current, 0, robotSize.y / 2, 0, robotSize.x, robotSize.y)
  }, [robotSize, camera, orbitRef])
}

function CameraAutoFit(props: { robotSize: RobotSize | null; orbitRef: OrbitRef }) {
  useCameraAutoFit(props.robotSize, props.orbitRef)
  return null
}

/**
 * Resolves the panel's scene theme.
 *
 * - `'light' | 'dark'`: caller controls; no DOM introspection.
 * - `'system'`: follows `prefers-color-scheme` — works everywhere without
 *   coupling to any ThemeProvider's DOM convention.
 * - `'dom-class'`: legacy path, kept as an opt-in for hosts (like this app)
 *   whose ThemeProvider toggles a `dark` class on `<html>`. Requires DOM.
 */
type PanelTheme = 'light' | 'dark' | 'system' | 'dom-class'

function useResolvedTheme(theme: PanelTheme): 'light' | 'dark' {
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
    if (theme === 'light' || theme === 'dark') return theme
    if (typeof window === 'undefined') return 'light'
    if (theme === 'dom-class') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    if (theme === 'light' || theme === 'dark') {
      setResolved(theme)
      return
    }
    if (typeof window === 'undefined') return

    if (theme === 'dom-class') {
      const el = document.documentElement
      const update = () => setResolved(el.classList.contains('dark') ? 'dark' : 'light')
      update()
      const observer = new MutationObserver(update)
      observer.observe(el, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    }

    // theme === 'system'
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setResolved(mql.matches ? 'dark' : 'light')
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [theme])

  return resolved
}

interface RobotViewerPanelProps {
  frames: EpisodeFrame[]
  jointNames: string[]
  urdf?: UrdfConfig
  requestHeaders?: Record<string, string>
  isLoading?: boolean
  /**
   * Scene theme. Defaults to `'system'` so library consumers don't have to
   * know anything about how the host tracks dark mode.
   */
  theme?: PanelTheme
}

export function RobotViewerPanel({
  frames,
  jointNames,
  urdf,
  requestHeaders,
  isLoading,
  theme = 'system',
}: RobotViewerPanelProps) {
  const { clock } = usePlayerContext()
  const sceneMode = useResolvedTheme(theme)
  const orbitRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const [robotSize, setRobotSize] = useState<RobotSize | null>(null)

  return (
    <PanelShell title="3D Robot" loading={isLoading} className="h-full">
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0.8, 3], fov: 55 }}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true }}
      >
        <CameraAutoFit robotSize={robotSize} orbitRef={orbitRef} />
        <SceneEnvironment mode={sceneMode} />
        {urdf && (
          <URDFRobotModel
            url={urdf.urdfUrl}
            packages={urdf.packages}
            requestHeaders={requestHeaders}
            frames={frames}
            jointNames={jointNames}
            currentTimeRef={clock.currentTimeRef}
            onBoundsReady={setRobotSize}
          />
        )}
        <OrbitControls
          ref={orbitRef}
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={10}
        />
      </Canvas>
    </PanelShell>
  )
}
