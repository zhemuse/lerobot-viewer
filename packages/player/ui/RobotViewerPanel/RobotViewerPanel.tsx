'use client'
import * as THREE from 'three'
import { useRef, useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { usePlayerContext } from '../../hooks/PlayerProvider'
import { PanelShell } from '../PanelShell'
import URDFRobotModel from './URDFRobot'
import SceneEnvironment from './SceneEnvironment'
import type { EpisodeFrame, UrdfConfig } from '../../core/types'

type RobotSize = { x: number; y: number; z: number }

function fitCameraToBox(
  camera: THREE.PerspectiveCamera,
  orbit: any,
  cx: number,
  cy: number,
  cz: number,
  sizeX: number,
  sizeY: number,
  padding = 1.2,
) {
  const fovY = (camera.fov * Math.PI) / 180
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * camera.aspect)
  const distY = (sizeY / 2) / Math.tan(fovY / 2)
  const distX = (sizeX / 2) / Math.tan(fovX / 2)
  const dist = Math.max(distY, distX) * padding
  camera.position.set(cx, cy, cz + dist)
  camera.updateProjectionMatrix()
  orbit.target.set(cx, cy, cz)
  orbit.update()
}

function useCameraAutoFit(robotSize: RobotSize | null, orbitRef: React.RefObject<any>) {
  const { camera } = useThree()
  useEffect(() => {
    if (!robotSize || !(camera instanceof THREE.PerspectiveCamera) || !orbitRef.current) return
    fitCameraToBox(camera, orbitRef.current, 0, robotSize.y / 2, 0, robotSize.x, robotSize.y)
  }, [robotSize, camera, orbitRef])
}

function CameraAutoFit(props: { robotSize: RobotSize | null; orbitRef: React.RefObject<any> }) {
  useCameraAutoFit(props.robotSize, props.orbitRef)
  return null
}

// 通过监听 <html> 上的 dark class 判断暗色模式，与任意 ThemeProvider 实现解耦
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    if (typeof document === 'undefined') return
    const el = document.documentElement
    const update = () => setIsDark(el.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

interface RobotViewerPanelProps {
  frames: EpisodeFrame[]
  jointNames: string[]
  urdf?: UrdfConfig
  requestHeaders?: Record<string, string>
  isLoading?: boolean
}

export function RobotViewerPanel({ frames, jointNames, urdf, requestHeaders, isLoading }: RobotViewerPanelProps) {
  const { clock } = usePlayerContext()
  const isDark = useIsDarkMode()
  const sceneMode = isDark ? 'dark' : 'light'
  const orbitRef = useRef<any>(null)
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
