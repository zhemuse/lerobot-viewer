import type { ThreeEvent } from '@react-three/fiber'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import URDFLoader, {
  type URDFCollider,
  type URDFJoint,
  type URDFLink,
  type URDFRobot,
} from 'urdf-loader'
import type { EpisodeFrame } from '../../core/types'
import { usePlaybackSync } from './usePlaybackSync'

// Precomputed rotation composite: URDF (Z-up) → Three.js (Y-up), then face the
// camera. Equivalent to two nested group rotations, folded into one quaternion.
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

type StlCache = Map<string, Promise<THREE.BufferGeometry | null>>

function serializeHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('\n')
}

/**
 * Loads and caches an STL geometry for the duration of a single URDF load.
 * The cache is passed in (not module-level) so it can be disposed cleanly when
 * the URDF unmounts — otherwise BufferGeometry GPU handles leak on every
 * URDF/dataset switch.
 */
function loadStlGeometry(
  cache: StlCache,
  path: string,
  manager: THREE.LoadingManager,
  requestHeaders: Record<string, string>,
): Promise<THREE.BufferGeometry | null> {
  const cacheKey = `${path}|${requestHeaders.Authorization || ''}`
  const cached = cache.get(cacheKey)
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
        cache.delete(cacheKey)
        resolve(null)
      },
    )
  })
  cache.set(cacheKey, promise)
  return promise
}

/** Dispose every geometry a cache holds and empty it. Awaits in-flight loads. */
function disposeStlCache(cache: StlCache): void {
  for (const promise of cache.values()) {
    promise
      .then((geom) => geom?.dispose())
      .catch(() => {
        /* load already failed / was cancelled */
      })
  }
  cache.clear()
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
  // Playback sync (optional)
  frames?: EpisodeFrame[]
  jointNames?: string[]
  currentTimeRef?: { current: number }
  // Event callbacks
  onRobotLoaded?: (robot: URDFRobot) => void
  onBoundsReady?: (size: { x: number; y: number; z: number }) => void
  onLoadError?: (err: unknown) => void
  onLoadingChange?: (loading: boolean) => void
  onLinkHover?: (info: LinkHoverInfo | null) => void
}

// Type guards over urdf-loader's discriminant fields. Every URDFBase subclass
// tags itself with an `is<Type>: true` field; we narrow with those.
function isURDFLink(obj: THREE.Object3D): obj is URDFLink {
  return (obj as URDFLink).isURDFLink === true
}
function isURDFJoint(obj: THREE.Object3D): obj is URDFJoint {
  return (obj as URDFJoint).isURDFJoint === true
}
function isURDFCollider(obj: THREE.Object3D): obj is URDFCollider {
  return (obj as URDFCollider).isURDFCollider === true
}

function highlightLinkGeometry(
  linkObj: THREE.Object3D,
  robot: URDFRobot,
  store: Map<THREE.Mesh, THREE.Material | THREE.Material[]>,
) {
  const traverse = (obj: THREE.Object3D, isRoot: boolean) => {
    if (!isRoot && isURDFLink(obj)) return
    if (isURDFJoint(obj)) {
      const joint = robot.joints[obj.name]
      if (joint?.jointType !== 'fixed') return
    }
    if (obj instanceof THREE.Mesh && !isURDFCollider(obj)) {
      store.set(obj, obj.material)
      obj.material = HIGHLIGHT_MATERIAL
    }
    for (const child of obj.children) traverse(child, false)
  }
  traverse(linkObj, true)
}

function unhighlightAll(store: Map<THREE.Mesh, THREE.Material | THREE.Material[]>) {
  store.forEach((origMat, mesh) => {
    mesh.material = origMat
  })
  store.clear()
}

function findURDFLink(obj: THREE.Object3D | null): URDFLink | null {
  let current: THREE.Object3D | null = obj
  while (current) {
    if (isURDFLink(current)) return current
    current = current.parent
  }
  return null
}

function findParentJoint(
  linkObj: THREE.Object3D,
  robot: URDFRobot,
): { name: string; jointType: string } | null {
  let current: THREE.Object3D | null = linkObj.parent
  while (current) {
    if (isURDFJoint(current)) {
      const joint = robot.joints[current.name]
      if (joint && joint.jointType !== 'fixed') {
        return { name: current.name, jointType: joint.jointType }
      }
    }
    current = current.parent
  }
  return null
}

function getFixedChildLinkNames(linkObj: THREE.Object3D, robot: URDFRobot): string[] {
  const names: string[] = []
  const collect = (obj: THREE.Object3D) => {
    for (const child of obj.children) {
      if (isURDFJoint(child)) {
        const joint = robot.joints[child.name]
        if (joint?.jointType === 'fixed') {
          for (const grandChild of child.children) {
            if (isURDFLink(grandChild)) {
              names.push(grandChild.name)
              collect(grandChild)
            }
          }
        }
      }
    }
  }
  collect(linkObj)
  return names
}

function getLinkMass(linkObj: THREE.Object3D): number | null {
  const urdfNode = isURDFLink(linkObj) ? linkObj.urdfNode : null
  if (!urdfNode) return null
  const massEl = urdfNode.querySelector('inertial mass')
  if (!massEl) return null
  const val = parseFloat(massEl.getAttribute('value') ?? '')
  return Number.isFinite(val) ? val : null
}

const fallbackTimeRef = { current: 0 }

const URDFRobotModel = forwardRef<URDFRobotHandle, URDFRobotProps>(function URDFRobotModel(
  {
    url,
    packages,
    requestHeaders = {},
    frames,
    jointNames,
    currentTimeRef,
    onRobotLoaded,
    onBoundsReady,
    onLoadError,
    onLoadingChange,
    onLinkHover,
  },
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

  // Callbacks are captured via refs so they don't appear in useEffect deps and
  // force a URDF reload every render.
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
      for (const [name, angle] of Object.entries(angles)) {
        r.setJointValue(name, angle)
      }
    },
    highlightJoints(jointNames: string[]) {
      const r = robotRef.current
      if (!r) return
      unhighlightAll(highlightedMeshesRef.current)
      hoveredLinkRef.current = null
      selectedJointsRef.current = jointNames
      for (const jointName of jointNames) {
        const joint = r.joints[jointName]
        if (!joint) continue
        const childLink = joint.children.find(isURDFLink)
        if (!childLink) continue
        highlightLinkGeometry(childLink, r, highlightedMeshesRef.current)
      }
    },
  }))

  useEffect(() => {
    let cancelled = false
    const highlightedMeshes = highlightedMeshesRef.current
    const stableRequestHeaders = stableRequestHeadersRef.current
    // Cache lives for this URDF load only. Disposed on cleanup so switching
    // URDFs / datasets never leaks BufferGeometry GPU handles.
    const stlCache: StlCache = new Map()
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
        const p = loadStlGeometry(stlCache, path, manager, stableRequestHeaders).then(
          (geometry) => {
            if (cancelled || !geometry) {
              done(new THREE.Object3D())
              return
            }
            done(new THREE.Mesh(geometry, ROBOT_MATERIAL))
          },
        )
        meshPromises.push(p)
      } else if (ext === 'dae') {
        const p = new Promise<void>((resolve) => {
          const colladaLoader = new ColladaLoader(manager)
          colladaLoader.setRequestHeader(stableRequestHeaders)
          colladaLoader.load(
            path,
            (collada) => {
              if (!cancelled && collada) {
                collada.scene.rotation.set(0, 0, 0)
                done(collada.scene)
              } else done(new THREE.Object3D())
              resolve()
            },
            undefined,
            () => {
              done(new THREE.Object3D())
              resolve()
            },
          )
        })
        meshPromises.push(p)
      } else {
        done(new THREE.Object3D())
      }
    }

    loader
      .loadAsync(url)
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
        if (!box.isEmpty() && Number.isFinite(box.min.y)) {
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
      // At this point the primitive is being unmounted (or replaced by a new
      // URDF load), so nothing is rendering these geometries anymore — safe to
      // free the GPU buffers.
      disposeStlCache(stlCache)
    }
  }, [url, packages]) // callbacks are held via refs, so they don't belong in deps

  // Internal handle for usePlaybackSync — kept separate from the public forwardRef.
  const internalHandleRef = useRef<URDFRobotHandle>({
    setJointValues(angles: Record<string, number>) {
      const r = robotRef.current
      if (!r) return
      for (const [name, angle] of Object.entries(angles)) {
        r.setJointValue(name, angle)
      }
    },
    highlightJoints() {},
  })

  usePlaybackSync({
    frames: frames ?? [],
    jointNames: jointNames ?? [],
    currentTimeRef: currentTimeRef ?? fallbackTimeRef,
    robotRef: internalHandleRef,
  })

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
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
      onLinkHover?.({
        linkName: link.name,
        jointName: parentJoint?.name ?? null,
        jointType: parentJoint?.jointType ?? null,
        mass,
        includedLinks,
        worldPosition,
        worldQuaternion,
      })
    },
    [onLinkHover],
  )

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
      <primitive object={robot} onPointerMove={handlePointerMove} onPointerOut={handlePointerOut} />
    </group>
  )
})

export default URDFRobotModel
