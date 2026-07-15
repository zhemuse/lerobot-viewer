import React, {
  useEffect, useState, forwardRef, useImperativeHandle,
  useRef, useCallback,
} from 'react'
import URDFLoader, { URDFRobot } from 'urdf-loader'
import * as THREE from 'three'
import { ThreeEvent } from '@react-three/fiber'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { usePlaybackSync } from './usePlaybackSync'
import type { EpisodeFrame } from '../../core/types'

// 预计算合并旋转：Z轴朝上 → Y轴朝上，再面向摄像机
// 等价于原先嵌套的两层 group rotation
const _qZ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))
const _qF = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))
const COMBINED_QUATERNION = _qF.clone().multiply(_qZ)

const ROBOT_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xc0c0c0,
  specular: 0x444444,
  shininess: 60,
})

const HIGHLIGHT_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 0.25,
  shininess: 10,
})

THREE.Cache.enabled = true

const stlGeometryCache = new Map<string, Promise<THREE.BufferGeometry | null>>()

function serializeHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('\n')
}

function loadStlGeometry(
  path: string,
  manager: THREE.LoadingManager,
  requestHeaders: Record<string, string>,
): Promise<THREE.BufferGeometry | null> {
  const cacheKey = `${path}|${requestHeaders.Authorization || ''}`
  const cached = stlGeometryCache.get(cacheKey)
  if (cached) return cached

  const promise = new Promise<THREE.BufferGeometry | null>((resolve) => {
    const stlLoader = new STLLoader(manager)
    stlLoader.setRequestHeader(requestHeaders)
    stlLoader.load(
      path,
      (geometry) => {
        if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
        resolve(geometry)
      },
      undefined,
      () => {
        stlGeometryCache.delete(cacheKey)
        resolve(null)
      },
    )
  })
  stlGeometryCache.set(cacheKey, promise)
  return promise
}

export interface LinkHoverInfo {
  linkName: string
  jointName: string | null
  jointType: string | null
  mass: number | null
  includedLinks: string[]
  worldPosition: THREE.Vector3
  worldQuaternion: THREE.Quaternion
}

export interface URDFRobotHandle {
  setJointValues: (angles: Record<string, number>) => void
  highlightJoints: (jointNames: string[]) => void
}

interface URDFRobotProps {
  url: string
  packages?: Record<string, string> | string
  requestHeaders?: Record<string, string>
  // 回放同步（可选）
  frames?: EpisodeFrame[]
  jointNames?: string[]
  currentTimeRef?: { current: number }
  // 事件回调
  onRobotLoaded?: (robot: URDFRobot) => void
  onBoundsReady?: (size: { x: number; y: number; z: number }) => void
  onLoadError?: (err: unknown) => void
  onLoadingChange?: (loading: boolean) => void
  onLinkHover?: (info: LinkHoverInfo | null) => void
}

function highlightLinkGeometry(
  linkObj: THREE.Object3D,
  robot: URDFRobot,
  store: Map<THREE.Mesh, THREE.Material | THREE.Material[]>,
) {
  const traverse = (obj: THREE.Object3D, isRoot: boolean) => {
    if (!isRoot && (obj as any).isURDFLink) return
    if ((obj as any).isURDFJoint) {
      const joint = (robot.joints as Record<string, any>)[obj.name]
      if (!joint || joint.jointType !== 'fixed') return
    }
    if (obj instanceof THREE.Mesh && !(obj as any).isURDFCollider) {
      store.set(obj, obj.material)
      obj.material = HIGHLIGHT_MATERIAL
    }
    for (const child of obj.children) traverse(child, false)
  }
  traverse(linkObj, true)
}

function unhighlightAll(store: Map<THREE.Mesh, THREE.Material | THREE.Material[]>) {
  store.forEach((origMat, mesh) => { mesh.material = origMat })
  store.clear()
}

function findURDFLink(obj: THREE.Object3D | null): THREE.Object3D | null {
  let current = obj
  while (current) {
    if ((current as any).isURDFLink) return current
    current = current.parent
  }
  return null
}

function findParentJoint(
  linkObj: THREE.Object3D,
  robot: URDFRobot,
): { name: string; jointType: string } | null {
  let current = linkObj.parent
  while (current) {
    if ((current as any).isURDFJoint) {
      const joint = (robot.joints as Record<string, any>)[current.name]
      if (joint && joint.jointType !== 'fixed') return { name: current.name, jointType: joint.jointType as string }
    }
    current = current.parent
  }
  return null
}

function getFixedChildLinkNames(linkObj: THREE.Object3D, robot: URDFRobot): string[] {
  const names: string[] = []
  const collect = (obj: THREE.Object3D) => {
    for (const child of obj.children) {
      if ((child as any).isURDFJoint) {
        const joint = (robot.joints as Record<string, any>)[child.name]
        if (joint?.jointType === 'fixed') {
          for (const grandChild of child.children) {
            if ((grandChild as any).isURDFLink) { names.push(grandChild.name); collect(grandChild) }
          }
        }
      }
    }
  }
  collect(linkObj)
  return names
}

function getLinkMass(linkObj: THREE.Object3D): number | null {
  const urdfNode = (linkObj as any).urdfNode as Element | undefined
  if (!urdfNode) return null
  const massEl = urdfNode.querySelector('inertial mass')
  if (!massEl) return null
  const val = parseFloat(massEl.getAttribute('value') ?? '')
  return isFinite(val) ? val : null
}

const fallbackTimeRef = { current: 0 }

const URDFRobotModel = forwardRef<URDFRobotHandle, URDFRobotProps>(function URDFRobotModel(
  { url, packages, requestHeaders = {}, frames, jointNames, currentTimeRef, onRobotLoaded, onBoundsReady, onLoadError, onLoadingChange, onLinkHover },
  ref,
) {
  const headersKey = serializeHeaders(requestHeaders)
  const stableRequestHeadersRef = useRef(requestHeaders)
  const prevHeadersKeyRef = useRef(headersKey)
  if (headersKey !== prevHeadersKeyRef.current) {
    prevHeadersKeyRef.current = headersKey
    stableRequestHeadersRef.current = requestHeaders
  }
  const [robot, setRobot] = useState<URDFRobot | null>(null)
  const [offset, setOffset] = useState<[number, number, number]>([0, 0, 0])
  const robotRef = useRef<URDFRobot | null>(null)
  const hoveredLinkRef = useRef<THREE.Object3D | null>(null)
  const highlightedMeshesRef = useRef<Map<THREE.Mesh, THREE.Material | THREE.Material[]>>(new Map())
  const selectedJointsRef = useRef<string[]>([])

  // 用 ref 持有 callbacks，避免进入 useEffect deps 导致重加载
  const onRobotLoadedRef = useRef(onRobotLoaded)
  onRobotLoadedRef.current = onRobotLoaded
  const onBoundsReadyRef = useRef(onBoundsReady)
  onBoundsReadyRef.current = onBoundsReady
  const onLoadErrorRef = useRef(onLoadError)
  onLoadErrorRef.current = onLoadError
  const onLoadingChangeRef = useRef(onLoadingChange)
  onLoadingChangeRef.current = onLoadingChange

  useImperativeHandle(ref, () => ({
    setJointValues(angles: Record<string, number>) {
      const r = robotRef.current
      if (!r) return
      Object.entries(angles).forEach(([name, angle]) => r.setJointValue(name, angle))
    },
    highlightJoints(jointNames: string[]) {
      const r = robotRef.current
      if (!r) return
      unhighlightAll(highlightedMeshesRef.current)
      hoveredLinkRef.current = null
      selectedJointsRef.current = jointNames
      for (const jointName of jointNames) {
        const joint = (r.joints as Record<string, any>)[jointName]
        if (!joint) continue
        const childLink = joint.children.find((c: any) => c.isURDFLink) as THREE.Object3D | undefined
        if (!childLink) continue
        highlightLinkGeometry(childLink, r, highlightedMeshesRef.current)
      }
    },
  }))

  useEffect(() => {
    let cancelled = false
    const highlightedMeshes = highlightedMeshesRef.current
    const stableRequestHeaders = stableRequestHeadersRef.current
    const loader = new URDFLoader()
    loader.fetchOptions = { headers: stableRequestHeaders }
    robotRef.current = null
    setRobot(null)
    setOffset([0, 0, 0])
    onLoadingChangeRef.current?.(true)

    if (packages) loader.packages = packages as Record<string, string>

    const meshPromises: Promise<void>[] = []

    loader.loadMeshCb = (path, manager, done) => {
      const ext = (path.split('.').pop() ?? '').toLowerCase()
      if (ext === 'stl') {
        const p = loadStlGeometry(path, manager, stableRequestHeaders).then((geometry) => {
          if (cancelled || !geometry) { done(new THREE.Object3D()); return }
          done(new THREE.Mesh(geometry, ROBOT_MATERIAL))
        })
        meshPromises.push(p)
      } else if (ext === 'dae') {
        const p = new Promise<void>((resolve) => {
          const colladaLoader = new ColladaLoader(manager)
          colladaLoader.setRequestHeader(stableRequestHeaders)
          colladaLoader.load(
            path,
            (collada) => {
              if (!cancelled && collada) { collada.scene.rotation.set(0, 0, 0); done(collada.scene) }
              else done(new THREE.Object3D())
              resolve()
            },
            undefined,
            () => { done(new THREE.Object3D()); resolve() },
          )
        })
        meshPromises.push(p)
      } else {
        done(new THREE.Object3D())
      }
    }

    loader.loadAsync(url)
      .then(async (r) => {
        if (cancelled) return
        await Promise.all(meshPromises)
        if (cancelled) return

        const innerGrp = new THREE.Group()
        innerGrp.rotation.set(-Math.PI / 2, 0, 0)
        innerGrp.add(r)
        const outerGrp = new THREE.Group()
        outerGrp.rotation.set(0, Math.PI / 2, 0)
        outerGrp.add(innerGrp)
        outerGrp.updateWorldMatrix(true, true)
        const box = new THREE.Box3().setFromObject(outerGrp)
        innerGrp.remove(r)
        if (!box.isEmpty() && isFinite(box.min.y)) {
          const center = box.getCenter(new THREE.Vector3())
          setOffset([-center.x, -box.min.y, -center.z])
          onBoundsReadyRef.current?.({
            x: box.max.x - box.min.x,
            y: box.max.y - box.min.y,
            z: box.max.z - box.min.z,
          })
        } else {
          setOffset([0, 0, 0])
        }
        robotRef.current = r
        setRobot(r)
        onLoadingChangeRef.current?.(false)
        onRobotLoadedRef.current?.(r)
      })
      .catch((err) => {
        if (cancelled) return
        robotRef.current = null
        setRobot(null)
        onLoadingChangeRef.current?.(false)
        onLoadErrorRef.current?.(err)
      })

    return () => {
      cancelled = true
      unhighlightAll(highlightedMeshes)
      hoveredLinkRef.current = null
    }
  }, [url, packages, headersKey]) // callbacks 通过 ref 持有，不进入 deps

  // 内部 handle，供 usePlaybackSync 使用，避免污染外部 forwardRef
  const internalHandleRef = useRef<URDFRobotHandle>({
    setJointValues(angles: Record<string, number>) {
      const r = robotRef.current
      if (!r) return
      Object.entries(angles).forEach(([name, angle]) => r.setJointValue(name, angle))
    },
    highlightJoints() {},
  })

  usePlaybackSync({
    frames: frames ?? [],
    jointNames: jointNames ?? [],
    currentTimeRef: currentTimeRef ?? fallbackTimeRef,
    robotRef: internalHandleRef,
  })

  const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    const r = robotRef.current
    if (!r) return
    if (selectedJointsRef.current.length > 0) return
    const link = findURDFLink(event.object as THREE.Object3D)
    if (!link) return
    if (hoveredLinkRef.current?.name === link.name) return
    if (hoveredLinkRef.current) unhighlightAll(highlightedMeshesRef.current)
    hoveredLinkRef.current = link
    highlightLinkGeometry(link, r, highlightedMeshesRef.current)
    const worldPosition = new THREE.Vector3()
    const worldQuaternion = new THREE.Quaternion()
    link.getWorldPosition(worldPosition)
    link.getWorldQuaternion(worldQuaternion)
    const parentJoint = findParentJoint(link, r)
    const mass = getLinkMass(link)
    const includedLinks = getFixedChildLinkNames(link, r)
    onLinkHover?.({ linkName: link.name, jointName: parentJoint?.name ?? null, jointType: parentJoint?.jointType ?? null, mass, includedLinks, worldPosition, worldQuaternion })
  }, [onLinkHover])

  const handlePointerOut = useCallback(() => {
    if (selectedJointsRef.current.length > 0) return
    if (hoveredLinkRef.current) {
      unhighlightAll(highlightedMeshesRef.current)
      hoveredLinkRef.current = null
      onLinkHover?.(null)
    }
  }, [onLinkHover])

  if (!robot) return null

  return (
    <group position={offset} quaternion={COMBINED_QUATERNION}>
      <primitive
        object={robot}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />
    </group>
  )
})

export default URDFRobotModel
