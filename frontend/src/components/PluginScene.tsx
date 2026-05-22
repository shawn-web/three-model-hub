import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSceneStore } from '../store/scene-store'
import { useViewerStore } from '../store/viewer-store'
import type { PluginManager } from '../core/plugin-manager'
import type { SectionPlugin, SectionState } from '../plugins/section'
import type { MeasurementPlugin, MeasurementData } from '../plugins/measurement'

interface PluginSceneProps {
  pluginManager: PluginManager
  modelGroupRef: React.RefObject<THREE.Group>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: React.RefObject<any>
}

export function PluginScene({ pluginManager, modelGroupRef, orbitRef }: PluginSceneProps) {
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const _modelObject = useSceneStore((s) => s.modelObject)
  // modelGroupRef 和 _modelObject 保留用于后续扩展
  void modelGroupRef
  void _modelObject

  // 收集所有激活插件的 sceneComponent
  const allPlugins = pluginManager.getAllPlugins()
  const sceneComponents = allPlugins
    .filter((p) => p.isActive() && p.sceneComponent)
    .map((p) => {
      const Comp = p.sceneComponent!
      return <Comp key={p.id} />
    })

  return (
    <>
      {/* 保留 section/measurement 的复杂 3D 渲染（内部状态与 PluginScene 深度耦合） */}
      {activePluginId === 'section' && <SectionScene pluginManager={pluginManager} orbitRef={orbitRef} />}
      {activePluginId === 'measurement' && <MeasurementScene pluginManager={pluginManager} />}
      {/* 所有其他插件的 sceneComponent */}
      {sceneComponents}
    </>
  )
}

// ─── SectionScene ──────────────────────────────────────────────────────────────

const AXIS_CONFIG = [
  { axis: 'x' as const, color: '#ff4444', direction: new THREE.Vector3(1, 0, 0) },
  { axis: 'y' as const, color: '#44ff44', direction: new THREE.Vector3(0, 1, 0) },
  { axis: 'z' as const, color: '#4488ff', direction: new THREE.Vector3(0, 0, 1) },
]

type Axis = 'x' | 'y' | 'z'

interface DragState {
  axis: Axis
  startPos: number
  dragPlane: THREE.Plane
  pointer: { x: number; y: number }
}

function SectionScene({ pluginManager, orbitRef }: { pluginManager: PluginManager; orbitRef: React.RefObject<unknown> }) {
  const modelObject = useSceneStore((s) => s.modelObject)
  const { camera, gl: glFromHook } = useThree()
  // 使用 ref 保存 hook 返回的 Three.js 对象，通过 effect 同步
  const glRef = useRef(glFromHook)
  useEffect(() => { glRef.current = glFromHook })

  const plugin = pluginManager.getPlugin('section') as unknown as SectionPlugin | undefined

  const [sectionState, setSectionState] = useState<SectionState>({
    planes: {
      x: { enabled: false, position: 0 },
      y: { enabled: false, position: 0 },
      z: { enabled: false, position: 0 },
    },
    bounds: {
      x: { min: -5, max: 5 },
      y: { min: -5, max: 5 },
      z: { min: -5, max: 5 },
    },
  })

  const dragStateRef = useRef<DragState | null>(null)
  const baseConeRadiusRef = useRef(1)
  const coneRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const handleRefs = useRef<Record<string, THREE.Object3D | null>>({})
  const lineRefsStore = useRef<Record<string, THREE.Mesh | null>>({})
  const planeVisualRefs = useRef<Record<string, THREE.Group | null>>({})

  const modelCenter = useMemo(() => {
    if (!modelObject) return new THREE.Vector3()
    const box = new THREE.Box3().setFromObject(modelObject)
    return box.getCenter(new THREE.Vector3())
  }, [modelObject])

  const modelSize = useMemo(() => {
    if (!modelObject) return new THREE.Vector3(5, 5, 5)
    const box = new THREE.Box3().setFromObject(modelObject)
    return box.getSize(new THREE.Vector3())
  }, [modelObject])

  const arrowLength = useMemo(() => {
    return Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.5
  }, [modelSize])

  // 监听插件状态变化，使用 useFrame 初始化避免 effect 中同步 setState
  const pluginInitialized = useRef(false)
  useEffect(() => {
    if (!plugin) return
    plugin.onStateChange((state) => setSectionState(state))
    // 标记需要在帧循环中初始化
    pluginInitialized.current = false
  }, [plugin])

  // 在 useFrame 中初始化状态（避免 effect 中同步 setState）
  useFrame(() => {
    if (plugin && !pluginInitialized.current) {
      pluginInitialized.current = true
      setSectionState(plugin.getState())
    }
  })

  useEffect(() => {
    const gl = glRef.current
    if (plugin && plugin.getActivePlaneCount() > 0) gl.localClippingEnabled = true
    return () => { gl.localClippingEnabled = false }
  }, [plugin])

  // 屏幕空间恒定大小缩放
  useFrame(() => {
    if (!modelObject) return
    // 在帧循环中更新 baseConeRadiusRef，避免渲染中修改 ref
    baseConeRadiusRef.current = arrowLength * 0.05
    const gl = glRef.current
    const pr = Math.min(window.devicePixelRatio, 2)
    const ch = gl.domElement.clientHeight
    const dist = camera.position.distanceTo(modelCenter)
    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const vh = 2 * dist * Math.tan(fov / 2)

    const s = (vh * 8) / (ch * pr * baseConeRadiusRef.current)
    ;[...Object.values(coneRefs.current), ...Object.values(handleRefs.current)]
      .forEach(m => { if (m) m.scale.setScalar(s) })

    const ls = (vh * 1) / (ch * pr * 0.02)
    Object.values(lineRefsStore.current).forEach(m => { if (m) m.scale.set(ls, 1, ls) })
  })

  // 拖拽逐帧更新（射线-平面求交，保证 1:1 同步）
  useFrame(() => {
    const ds = dragStateRef.current
    if (!ds || !plugin) return
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ds.pointer.x, ds.pointer.y), camera)
    const intersection = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(ds.dragPlane, intersection)
    if (!hit) return
    let v: number
    switch (ds.axis) { case 'x': v = intersection.x; break; case 'y': v = intersection.y; break; case 'z': v = intersection.z; break }
    const b = plugin.getBounds(ds.axis)
    v = Math.max(b.min, Math.min(b.max, v))
    plugin.setPosition(ds.axis, v)
    const hm = handleRefs.current[ds.axis]
    if (hm) {
      const p = modelCenter.clone()
      switch (ds.axis) { case 'x': p.x = v; break; case 'y': p.y = v; break; case 'z': p.z = v; break }
      hm.position.copy(p)
    }
    // 更新剖面可视化位置（直接操作 Three.js 对象，不依赖 React 重渲染）
    const vg = planeVisualRefs.current[ds.axis]
    if (vg) {
      const p = modelCenter.clone()
      switch (ds.axis) { case 'x': p.x = v; break; case 'y': p.y = v; break; case 'z': p.z = v; break }
      vg.position.copy(p)
    }
  })

  // 开始拖拽
  const startDrag = useCallback((axis: Axis, e: React.PointerEvent | PointerEvent) => {
    if (!plugin) return
    ;(e as unknown as React.PointerEvent).preventDefault?.()

    // 从 plugin 直接读取最新状态（避免过期闭包）
    const currentState = plugin.getState()

    // 单轴模式：自动启用该轴
    if (!currentState.planes[axis].enabled) {
      plugin.toggle(axis, true)
    }

    const pos = plugin.getState().planes[axis].position
    const hp = modelCenter.clone()
    switch (axis) { case 'x': hp.x = pos; break; case 'y': hp.y = pos; break; case 'z': hp.z = pos; break }

    // 构造垂直于相机视线的拖拽平面，经过手柄世界位置
    const cameraDir = new THREE.Vector3()
    camera.getWorldDirection(cameraDir)
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, hp)

    const canvas = glRef.current.domElement
    const rect = canvas.getBoundingClientRect()
    const pointer = { x: 0, y: 0 }

    const update = (ev: PointerEvent) => {
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    }

    const ne = (e as React.PointerEvent).nativeEvent || e
    update(ne as PointerEvent)

    dragStateRef.current = {
      axis,
      startPos: pos,
      dragPlane,
      pointer,
    }
    if (orbitRef.current) { (orbitRef.current as { enabled: boolean }).enabled = false }

    const onMove = (ev: PointerEvent) => update(ev)
    const onUp = () => {
      dragStateRef.current = null
      if (orbitRef.current) { (orbitRef.current as { enabled: boolean }).enabled = true }
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [plugin, modelCenter, camera, orbitRef])

  if (!modelObject || !plugin) return null

  // 计算当前 handleScale（仅用于渲染，baseConeRadiusRef 在 useFrame 中更新）
  const handleScale = arrowLength * 0.05

  return (
    <group renderOrder={999}>
      {/* 每个轴的 Gizmo */}
      {AXIS_CONFIG.map(({ axis, color, direction }) => {
        const endPos = modelCenter.clone().addScaledVector(direction, arrowLength)
        const isEnabled = sectionState.planes[axis].enabled
        const sectionPoint = modelCenter.clone()
        switch (axis) {
          case 'x': sectionPoint.x = sectionState.planes[axis].position; break
          case 'y': sectionPoint.y = sectionState.planes[axis].position; break
          case 'z': sectionPoint.z = sectionState.planes[axis].position; break
        }

        return (
          <group key={axis}>
            <SectionLine start={modelCenter} end={endPos} color={color} isSelected={isEnabled} onLineRef={(id, el) => { lineRefsStore.current[id] = el }} />
            {/* 锥体端点 — 唯一的轴切换入口 */}
            <mesh
              ref={(el) => { coneRefs.current[axis] = el }}
              position={endPos}
              rotation={getConeRotation(axis)}
              renderOrder={999}
              onPointerDown={(e) => { e.stopPropagation(); startDrag(axis, e as unknown as PointerEvent) }}
            >
              <coneGeometry args={[handleScale, handleScale * 2.5, 12]} />
              <meshBasicMaterial color={color} transparent opacity={isEnabled ? 0.9 : 0.5} depthTest={false} />
            </mesh>
            {/* 手柄球体 */}
            {isEnabled && (
              <group ref={(el) => { handleRefs.current[axis] = el }} position={sectionPoint} renderOrder={1000}>
                <mesh
                  onPointerDown={(e) => { e.stopPropagation(); startDrag(axis, e as unknown as PointerEvent) }}
                >
                  <sphereGeometry args={[handleScale * 1.5, 16, 16]} />
                  <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
                </mesh>
              </group>
            )}
            {/* 半透明剖面圆面 */}
            {isEnabled && (
              <SectionPlaneVisual axis={axis} position={sectionState.planes[axis].position} modelCenter={modelCenter} modelSize={modelSize} color={color} groupRef={(el) => { planeVisualRefs.current[axis] = el }} />
            )}
            <Html position={endPos.clone().addScaledVector(direction, handleScale * 2).toArray()} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div style={{
                background: 'rgba(0,0,0,0.85)', color, padding: '2px 6px', borderRadius: '3px',
                fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap',
                border: `1px solid ${isEnabled ? color : 'transparent'}`, opacity: isEnabled ? 1 : 0.7,
              }}>
                {axis.toUpperCase()}{isEnabled ? `: ${sectionState.planes[axis].position.toFixed(2)}` : ''}
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

function getConeRotation(axis: Axis): [number, number, number] {
  switch (axis) {
    case 'x': return [0, 0, -Math.PI / 2]
    case 'y': return [0, 0, 0]
    case 'z': return [Math.PI / 2, 0, 0]
  }
}

/** 剖面线段 */
function SectionLine({ start, end, color, isSelected, onLineRef }: {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  isSelected: boolean
  onLineRef: (id: string, el: THREE.Mesh | null) => void
}) {
  const mid = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5), [start, end])
  const length = useMemo(() => start.distanceTo(end), [start, end])
  const rotation = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(end, start).normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const euler = new THREE.Euler().setFromQuaternion(quat)
    return [euler.x, euler.y, euler.z] as [number, number, number]
  }, [start, end])

  const id = useMemo(() => `line-${start.toArray().join(',')}-${end.toArray().join(',')}`, [start, end])

  return (
    <mesh
      ref={(el) => {
        if (el) el.raycast = () => {}
        onLineRef(id, el)
      }}
      position={mid}
      rotation={rotation}
      renderOrder={998}
    >
      <cylinderGeometry args={[0.02, 0.02, length, 8]} />
      <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.85 : 0.35} depthTest={false} />
    </mesh>
  )
}

/** 半透明剖面平面可视化 */
function SectionPlaneVisual({
  axis, position, modelCenter, modelSize, color, groupRef,
}: {
  axis: Axis
  position: number
  modelCenter: THREE.Vector3
  modelSize: THREE.Vector3
  color: string
  groupRef?: (el: THREE.Group | null) => void
}) {
  const radius = Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.6

  const positionVec = useMemo(() => {
    const pos = modelCenter.clone()
    switch (axis) {
      case 'x': pos.x = position; break
      case 'y': pos.y = position; break
      case 'z': pos.z = position; break
    }
    return pos
  }, [axis, position, modelCenter])

  const rotation = useMemo(() => {
    switch (axis) {
      case 'x': return [0, Math.PI / 2, 0] as [number, number, number]
      case 'y': return [-Math.PI / 2, 0, 0] as [number, number, number]
      case 'z': return [0, 0, 0] as [number, number, number]
    }
  }, [axis])

  const circlePoints = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 64
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
    }
    return pts
  }, [radius])

  return (
    <group ref={groupRef} position={positionVec} rotation={rotation} renderOrder={997}>
      <mesh ref={(el) => { if (el) el.raycast = () => {} }} renderOrder={997}>
        <circleGeometry args={[radius, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <Line points={circlePoints} lineWidth={1.5} color={color} transparent depthTest={false} opacity={0.5} />
    </group>
  )
}

// ─── MeasurementScene ──────────────────────────────────────────────────────────

function MeasurementScene({ pluginManager }: { pluginManager: PluginManager }) {
  const modelObject = useSceneStore((s) => s.modelObject)
  const { camera, gl: glFromHook } = useThree()
  // 使用 ref 保存 hook 返回的 Three.js 对象，通过 effect 同步
  const glRef = useRef(glFromHook)
  useEffect(() => { glRef.current = glFromHook })

  const plugin = pluginManager.getPlugin('measurement') as unknown as MeasurementPlugin | undefined

  const [measurements, setMeasurements] = useState<MeasurementData[]>([])
  const [pendingStart, setPendingStart] = useState<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!plugin) return
    plugin.onStateChange((newMeasurements, newPending) => {
      setMeasurements([...newMeasurements])
      setPendingStart(newPending ? newPending.clone() : null)
    })
  }, [plugin])

  useEffect(() => {
    if (!plugin || !modelObject) return

    const canvas = glRef.current.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(modelObject.children, true)
      if (intersects.length === 0) return
      const point = intersects[0].point
      plugin.addPoint(point.clone())
    }

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      if (plugin.getPendingStart()) {
        plugin.cancelPending()
      }
    }

    canvas.addEventListener('click', onClick)
    canvas.addEventListener('contextmenu', onContextMenu)
    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [plugin, modelObject, camera])

  useEffect(() => {
    if (!plugin) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (plugin.getPendingStart()) {
          plugin.cancelPending()
        } else {
          plugin.clearAll()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [plugin])

  // 使用 useFrame 设置光标样式，避免修改 hook 返回值
  useFrame(() => {
    const canvas = glRef.current.domElement
    canvas.style.cursor = 'crosshair'
  })

  // 卸载时恢复默认光标
  useEffect(() => {
    return () => {
      const canvas = glRef.current.domElement
      canvas.style.cursor = 'default'
    }
  }, [])

  if (!modelObject || !plugin) return null

  const modelBox = new THREE.Box3().setFromObject(modelObject)
  const modelExtent = modelBox.getSize(new THREE.Vector3()).length()

  return (
    <group>
      {pendingStart && (
        <MeasurementPoint position={pendingStart} scale={modelExtent} isPending camera={camera} />
      )}
      {measurements.map((m) => (
        <MeasurementVisualization key={m.id} measurement={m} modelExtent={modelExtent} plugin={plugin} camera={camera} />
      ))}
    </group>
  )
}

function MeasurementPoint({ position, scale, isPending, camera }: {
  position: THREE.Vector3
  scale: number
  isPending?: boolean
  camera: THREE.Camera
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const baseRadius = Math.max(scale * 0.005, 0.006)

  useFrame(() => {
    if (!meshRef.current) return
    const dist = camera.position.distanceTo(position)
    const screenRadius = baseRadius * dist * 0.1
    meshRef.current.scale.setScalar(screenRadius / baseRadius)
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[baseRadius, 12, 12]} />
      <meshBasicMaterial
        color={isPending ? '#ffaa44' : '#4a9eff'}
        depthTest={false}
      />
    </mesh>
  )
}

function MeasurementVisualization({ measurement, modelExtent, plugin, camera }: {
  measurement: MeasurementData
  modelExtent: number
  plugin: MeasurementPlugin
  camera: THREE.Camera
}) {
  const { start, end, distance } = measurement
  const midPoint = useMemo(
    () => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
    [start, end]
  )
  const formatted = plugin.formatDistance(distance)

  return (
    <group>
      <MeasurementPoint position={start} scale={modelExtent} camera={camera} />
      <MeasurementPoint position={end} scale={modelExtent} camera={camera} />
      <Line points={[start.toArray(), end.toArray()]} color="#4a9eff" lineWidth={3} />
      <Html position={midPoint} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span style={{ color: '#4a9eff', fontSize: 11, fontFamily: 'monospace', textShadow: '0 0 4px rgba(0,0,0,0.8)' }}>
          {formatted}
        </span>
      </Html>
    </group>
  )
}
