import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Line, Html, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import type { PluginManager } from '../core/plugin-manager'
import type { SectionPlugin } from '../plugins/section'
import type { MeasurementPlugin, MeasurementData } from '../plugins/measurement'

import { AnnotationSprite } from './AnnotationSprite'

interface PluginSceneProps {
  pluginManager: PluginManager
  modelGroupRef: React.RefObject<THREE.Group>
  orbitRef: React.RefObject<any>
}

export function PluginScene({ pluginManager, modelGroupRef, orbitRef }: PluginSceneProps) {
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const rotationMode = useViewerStore((s) => s.rotationMode)
  const modelObject = useViewerStore((s) => s.modelObject)
  const annotations = useViewerStore((s) => s.annotations)
  const addingAnnotation = useViewerStore((s) => s.addingAnnotation)

const { camera, gl } = useThree()
  useEffect(() => {
    if (!addingAnnotation || !modelObject) return

    const canvas = gl.domElement
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
      const cb = useViewerStore.getState().onAnnotationClick
      if (cb) {
        cb({ x: point.x, y: point.y, z: point.z })
      }
    }

    canvas.addEventListener('click', onClick)
    canvas.style.cursor = 'crosshair'
    return () => {
      canvas.removeEventListener('click', onClick)
      canvas.style.cursor = 'default'
    }
  }, [addingAnnotation, modelObject, camera, gl])

  const modelExtent = useMemo(() => {
    if (!modelObject) return 1
    const box = new THREE.Box3().setFromObject(modelObject)
    return box.getSize(new THREE.Vector3()).length()
  }, [modelObject])

  return (
    <>
      {activePluginId === 'section' && <SectionScene pluginManager={pluginManager} orbitRef={orbitRef} />}
      {activePluginId === 'measurement' && <MeasurementScene pluginManager={pluginManager} />}
      {rotationMode && modelGroupRef.current && (
        <RotationControls target={modelGroupRef.current} orbitRef={orbitRef} />
      )}
      {annotations.map((annotation, index) => (
        <AnnotationSprite
          key={annotation.id}
          annotation={annotation}
          index={index}
          modelExtent={modelExtent}
        />
      ))}
    </>
  )
}

// ─── SectionScene ──────────────────────────────────────────────────────────────

const AXIS_CONFIG = [
  { axis: 'x' as const, color: '#ff4444', direction: new THREE.Vector3(1, 0, 0) },
  { axis: 'y' as const, color: '#44ff44', direction: new THREE.Vector3(0, 1, 0) },
  { axis: 'z' as const, color: '#4488ff', direction: new THREE.Vector3(0, 0, 1) },
]

interface DragState {
  axis: 'x' | 'y' | 'z'
  plane: THREE.Plane
}

function SectionScene({ pluginManager, orbitRef }: { pluginManager: PluginManager; orbitRef: React.RefObject<any> }) {
  const modelObject = useViewerStore((s) => s.modelObject)
  const { camera, gl } = useThree()

  const plugin = pluginManager.getPlugin('section') as unknown as SectionPlugin | undefined

  const [sectionState, setSectionState] = useState<{
    axis: 'x' | 'y' | 'z'
    position: number
    enabled: boolean
    bounds: { min: number; max: number }
  }>({
    axis: 'y',
    position: 0,
    enabled: false,
    bounds: { min: -5, max: 5 },
  })

  const dragStateRef = useRef<DragState | null>(null)
  const handleMeshRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const lineMeshRefs = useRef<Record<string, THREE.Mesh | null>>({})
  const baseConeRadiusRef = useRef(1)

  useFrame(() => {
    if (!modelObject) return
    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    const canvasHeight = gl.domElement.clientHeight
    const distance = camera.position.distanceTo(modelCenter)
    const fovRad = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180)
    const viewportHeight = 2 * distance * Math.tan(fovRad / 2)

    const targetPixels = 20
    const worldSize = (viewportHeight * targetPixels) / (canvasHeight * pixelRatio)
    const s = worldSize / baseConeRadiusRef.current
    Object.values(handleMeshRefs.current).forEach(m => {
      if (m) m.scale.setScalar(s)
    })

    const lineTargetPixels = 3
    const lineWorldSize = (viewportHeight * lineTargetPixels) / (canvasHeight * pixelRatio)
    const ls = lineWorldSize / 0.02
    Object.values(lineMeshRefs.current).forEach(m => {
      if (m) m.scale.set(ls, 1, ls)
    })
  })

  useEffect(() => {
    if (!plugin) return
    plugin.onStateChange((state) => {
      setSectionState(state)
    })
    setSectionState(plugin.getState())
  }, [plugin])

  useEffect(() => {
    if (plugin && plugin.isEnabled()) {
      gl.localClippingEnabled = true
    }
    return () => {
      gl.localClippingEnabled = false
    }
  }, [plugin, gl, sectionState.enabled])

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

  const pointerRef = useRef({ x: 0, y: 0 })

  // 拖拽时逐帧更新剖切位置
  useFrame(() => {
    const ds = dragStateRef.current
    if (!ds || !plugin) return

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2(pointerRef.current.x, pointerRef.current.y)
    raycaster.setFromCamera(mouse, camera)

    const intersection = new THREE.Vector3()
    if (raycaster.ray.intersectPlane(ds.plane, intersection)) {
      let value: number
      switch (ds.axis) {
        case 'x': value = intersection.x; break
        case 'y': value = intersection.y; break
        case 'z': value = intersection.z; break
      }
      const bounds = plugin.getBounds()
      value = Math.max(bounds.min, Math.min(bounds.max, value))
      plugin.setPosition(value)

      const handleMesh = handleMeshRefs.current[ds.axis + '-handle']
      if (handleMesh) {
        const pos = modelCenter.clone()
        switch (ds.axis) {
          case 'x': pos.x = value; break
          case 'y': pos.y = value; break
          case 'z': pos.z = value; break
        }
        handleMesh.position.copy(pos)
      }
    }
  })

  const handlePointerDown = useCallback((axis: 'x' | 'y' | 'z', e: any) => {
    e.stopPropagation()
    if (!plugin) return

    plugin.setAxis(axis)
    if (!plugin.isEnabled()) {
      plugin.toggle(true)
    }

    const currentPosition = plugin.getPosition()
    const handlePos = modelCenter.clone()
    switch (axis) {
      case 'x': handlePos.x = currentPosition; break
      case 'y': handlePos.y = currentPosition; break
      case 'z': handlePos.z = currentPosition; break
    }

    const axisDir = new THREE.Vector3()
    switch (axis) {
      case 'x': axisDir.set(1, 0, 0); break
      case 'y': axisDir.set(0, 1, 0); break
      case 'z': axisDir.set(0, 0, 1); break
    }
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)

    let planeNormal = new THREE.Vector3().crossVectors(axisDir, camDir)
    if (planeNormal.length() < 0.001) {
      planeNormal.crossVectors(camera.up, axisDir)
    }
    planeNormal.normalize()
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, handlePos)
    dragStateRef.current = { axis, plane: dragPlane }

    if (orbitRef.current) orbitRef.current.enabled = false

    const canvas = gl.domElement
    const rect = canvas.getBoundingClientRect()
    pointerRef.current.x = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1
    pointerRef.current.y = -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onPointerUp = () => {
      dragStateRef.current = null
      if (orbitRef.current) orbitRef.current.enabled = true
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
  }, [plugin, modelCenter, camera, gl, orbitRef])

  if (!modelObject || !plugin) return null

  return (
    <group renderOrder={999}>
      {AXIS_CONFIG.map(({ axis, color, direction }) => {
        const startPos = modelCenter.clone()
        const endPos = modelCenter.clone().addScaledVector(direction, arrowLength)
        const isSelected = sectionState.axis === axis && sectionState.enabled
        const handleScale = arrowLength * 0.05
        baseConeRadiusRef.current = handleScale
        // 剖切位置对应的线上的点
        const sectionPoint = modelCenter.clone()
        switch (axis) {
          case 'x': sectionPoint.x = sectionState.position; break
          case 'y': sectionPoint.y = sectionState.position; break
          case 'z': sectionPoint.z = sectionState.position; break
        }

        return (
          <group key={axis}>
            {/* 剖面轴线：超薄圆柱体，不大不小始终一致 */}
            <SectionLine
              start={startPos}
              end={endPos}
              color={color}
              isSelected={isSelected}
              lineRefs={lineMeshRefs}
            />

            {/* 箭头锥体 */}
            <mesh
              ref={(el) => { handleMeshRefs.current[axis + '-cone'] = el }}
              position={endPos}
              rotation={getConeRotation(axis)}
              onPointerDown={(e) => handlePointerDown(axis, e)}
              renderOrder={999}
            >
              <coneGeometry args={[handleScale, handleScale * 3, 12]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.9 : 0.5}
                depthTest={false}
              />
            </mesh>

            {/* 扩大点击区域的隐形球 */}
            <mesh ref={(el) => { handleMeshRefs.current[axis + '-sphere'] = el }} position={endPos} onPointerDown={(e) => handlePointerDown(axis, e)}>
              <sphereGeometry args={[handleScale * 2.5, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthTest={false} />
            </mesh>

            {/* 线上可拖动的位置手柄 */}
            {isSelected && sectionState.enabled && (
              <mesh
                ref={(el) => { handleMeshRefs.current[axis + '-handle'] = el }}
                position={sectionPoint}
                onPointerDown={(e) => handlePointerDown(axis, e)}
                renderOrder={1000}
              >
                <sphereGeometry args={[handleScale * 1.5, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.8} depthTest={false} />
              </mesh>
            )}

            {/* 位置标签 */}
            <Html
              position={endPos.clone().addScaledVector(direction, handleScale * 2).toArray()}
              center
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div style={{
                background: 'rgba(0,0,0,0.85)',
                color: color,
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                border: `1px solid ${isSelected ? color : 'transparent'}`,
                opacity: isSelected ? 1 : 0.7,
              }}>
                {axis.toUpperCase()}
                {isSelected && sectionState.enabled ? `: ${sectionState.position.toFixed(2)}` : ''}
              </div>
            </Html>

            {/* 剖切平面可视化 */}
            {isSelected && sectionState.enabled && (
              <SectionPlane
                axis={axis}
                position={sectionState.position}
                modelCenter={modelCenter}
                modelSize={modelSize}
                color={color}
              />
            )}
          </group>
        )
      })}
    </group>
  )
}

function getConeRotation(axis: 'x' | 'y' | 'z'): [number, number, number] {
  switch (axis) {
    case 'x': return [0, 0, -Math.PI / 2]
    case 'y': return [0, 0, 0]
    case 'z': return [Math.PI / 2, 0, 0]
  }
}

/** 剖面线段组件：超薄圆柱体，屏幕空间恒定粗细 */
function SectionLine({ start, end, color, isSelected, lineRefs }: {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  isSelected: boolean
  lineRefs: React.MutableRefObject<Record<string, THREE.Mesh | null>>
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
        lineRefs.current[id] = el
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

function SectionPlane({
  axis, position, modelCenter, modelSize, color,
}: {
  axis: 'x' | 'y' | 'z'
  position: number
  modelCenter: THREE.Vector3
  modelSize: THREE.Vector3
  color: string
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

  // 十字线（水平 + 垂直，两条独立线段）
  const hLine = useMemo(() => [
    new THREE.Vector3(-radius, 0, 0),
    new THREE.Vector3(radius, 0, 0),
  ], [radius])
  const vLine = useMemo(() => [
    new THREE.Vector3(0, -radius, 0),
    new THREE.Vector3(0, radius, 0),
  ], [radius])

  const circlePoints = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const segments = 64
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
    }
    return pts
  }, [radius])

  const lineMatProps = { color, transparent: true as const, depthTest: false }

  return (
    <group position={positionVec} rotation={rotation} renderOrder={997}>
      {/* 半透明圆形填充 */}
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
      {/* 圆形轮廓 */}
      <Line
        points={circlePoints}
        lineWidth={1.5}
        {...lineMatProps}
        opacity={0.5}
      />
      {/* 水平十字线 */}
      <Line
        points={hLine}
        lineWidth={1}
        {...lineMatProps}
        opacity={0.35}
      />
      {/* 垂直十字线 */}
      <Line
        points={vLine}
        lineWidth={1}
        {...lineMatProps}
        opacity={0.35}
      />
    </group>
  )
}

// ─── MeasurementScene ──────────────────────────────────────────────────────────

function MeasurementScene({ pluginManager }: { pluginManager: PluginManager }) {
  const modelObject = useViewerStore((s) => s.modelObject)
  const { camera, gl } = useThree()

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

    const canvas = gl.domElement
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
  }, [plugin, modelObject, camera, gl])

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

  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.cursor = 'crosshair'
    return () => { canvas.style.cursor = 'default' }
  }, [gl])

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
  const baseRadius = Math.max(scale * 0.012, 0.015)

  useFrame(() => {
    if (!meshRef.current) return
    const dist = camera.position.distanceTo(position)
    const screenRadius = baseRadius * dist * 0.25
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

// ─── RotationControls ─────────────────────────────────────────────────────────

function RotationControls({ target, orbitRef }: { target: THREE.Object3D; orbitRef: React.RefObject<any> }) {
  const transformRef = useRef<any>(null)

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    const onDraggingChanged = (event: { value: boolean }) => {
      if (orbitRef.current) orbitRef.current.enabled = !event.value
    }
    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => { controls.removeEventListener('dragging-changed', onDraggingChanged) }
  }, [orbitRef])

  return (
    <TransformControls ref={transformRef} object={target} mode="rotate" size={0.7} />
  )
}
