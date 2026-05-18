import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Line, Html, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import type { PluginManager } from '../core/plugin-manager'
import type { SectionPlugin } from '../plugins/section'
import type { MeasurementPlugin, MeasurementData } from '../plugins/measurement'

// ─── PluginScene ───────────────────────────────────────────────────────────────
// Top-level container that renders inside the Canvas.
// Reads activePluginId from the store and renders the appropriate scene elements.

interface PluginSceneProps {
  pluginManager: PluginManager
  modelGroupRef: React.RefObject<THREE.Group>
  orbitRef: React.RefObject<any>
}

export function PluginScene({ pluginManager, modelGroupRef, orbitRef }: PluginSceneProps) {
  const activePluginId = useViewerStore((s) => s.activePluginId)
  const rotationMode = useViewerStore((s) => s.rotationMode)

  return (
    <>
      {activePluginId === 'section' && <SectionScene pluginManager={pluginManager} orbitRef={orbitRef} />}
      {activePluginId === 'measurement' && <MeasurementScene pluginManager={pluginManager} />}
      {rotationMode && modelGroupRef.current && (
        <RotationControls
          target={modelGroupRef.current}
          orbitRef={orbitRef}
        />
      )}
    </>
  )
}

// ─── SectionScene ──────────────────────────────────────────────────────────────
// Renders 3 axis arrows with draggable handles at model center.
// Clicking a handle selects that axis, enabling sectioning with a semi-transparent plane.
// Dragging the handle moves the section plane along the axis.

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

  // Subscribe to plugin state changes
  useEffect(() => {
    if (!plugin) return
    plugin.onStateChange((state) => {
      setSectionState(state)
    })
    // Initial state
    setSectionState(plugin.getState())
  }, [plugin])

  // Enable clipping on renderer
  useEffect(() => {
    if (plugin && plugin.isEnabled()) {
      gl.localClippingEnabled = true
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
    return Math.max(modelSize.x, modelSize.y, modelSize.z) * 0.6
  }, [modelSize])

  // Track the current mouse/pointer position for useFrame
  const pointerRef = useRef({ x: 0, y: 0 })

  // useFrame-based drag tracking
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
    }
  })

  // Handle pointer down on an axis handle
  const handlePointerDown = useCallback((axis: 'x' | 'y' | 'z', e: any) => {
    e.stopPropagation()
    if (!plugin) return

    // Select this axis
    plugin.setAxis(axis)

    // If not yet enabled, enable it
    if (!plugin.isEnabled()) {
      plugin.toggle(true)
    }

    // Set up drag plane perpendicular to camera through the handle position
    const handlePos = modelCenter.clone()
    const dir = AXIS_CONFIG.find((a) => a.axis === axis)!.direction
    handlePos.addScaledVector(dir, arrowLength)

    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.negate(), handlePos)
    dragStateRef.current = { axis, plane: dragPlane }

    // Disable orbit controls during drag
    if (orbitRef.current) orbitRef.current.enabled = false

    // Track pointer position for useFrame drag
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
  }, [plugin, modelCenter, arrowLength, camera, gl, orbitRef])

  if (!modelObject || !plugin) return null

  return (
    <group>
      {AXIS_CONFIG.map(({ axis, color, direction }) => {
        const startPos = modelCenter.clone()
        const endPos = modelCenter.clone().addScaledVector(direction, arrowLength)
        const isSelected = sectionState.axis === axis && sectionState.enabled
        const handleScale = arrowLength * 0.06

        return (
          <group key={axis}>
            {/* Axis line */}
            <Line
              points={[startPos.toArray(), endPos.toArray()]}
              color={isSelected ? color : color}
              lineWidth={isSelected ? 3 : 1.5}
              opacity={isSelected ? 1.0 : 0.6}
              transparent
            />

            {/* Draggable handle (cone) */}
            <mesh
              position={endPos}
              onPointerDown={(e) => handlePointerDown(axis, e)}
            >
              <coneGeometry args={[handleScale, handleScale * 3, 12]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.9 : 0.5}
                depthTest={false}
              />
            </mesh>

            {/* Larger invisible hit area for easier grabbing */}
            <mesh
              position={endPos}
              onPointerDown={(e) => handlePointerDown(axis, e)}
            >
              <sphereGeometry args={[handleScale * 2.5, 8, 8]} />
              <meshBasicMaterial
                visible={false}
                transparent
                opacity={0}
              />
            </mesh>

            {/* Section plane (semi-transparent) */}
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

      {/* Position indicator handle on the active axis */}
      {sectionState.enabled && (
        <SectionPositionHandle
          axis={sectionState.axis}
          position={sectionState.position}
          modelCenter={modelCenter}
          arrowLength={arrowLength}
          handlePointerDown={handlePointerDown}
        />
      )}
    </group>
  )
}

// Semi-transparent section plane
function SectionPlane({
  axis,
  position,
  modelCenter,
  modelSize,
  color,
}: {
  axis: 'x' | 'y' | 'z'
  position: number
  modelCenter: THREE.Vector3
  modelSize: THREE.Vector3
  color: string
}) {
  const planeSize = Math.max(modelSize.x, modelSize.y, modelSize.z) * 2

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

  return (
    <mesh position={positionVec} rotation={rotation}>
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// Draggable position indicator on the active section axis
function SectionPositionHandle({
  axis,
  position,
  modelCenter,
  arrowLength,
  handlePointerDown,
}: {
  axis: 'x' | 'y' | 'z'
  position: number
  modelCenter: THREE.Vector3
  arrowLength: number
  handlePointerDown: (axis: 'x' | 'y' | 'z', e: any) => void
}) {
  const handlePos = useMemo(() => {
    const pos = modelCenter.clone()
    switch (axis) {
      case 'x': pos.x = position; break
      case 'y': pos.y = position; break
      case 'z': pos.z = position; break
    }
    return pos
  }, [axis, position, modelCenter])

  const handleScale = arrowLength * 0.04

  return (
    <group>
      {/* Position sphere handle */}
      <mesh
        position={handlePos}
        onPointerDown={(e) => handlePointerDown(axis, e)}
      >
        <sphereGeometry args={[handleScale * 1.5, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.8}
          depthTest={false}
        />
      </mesh>

      {/* Larger invisible hit area */}
      <mesh
        position={handlePos}
        onPointerDown={(e) => handlePointerDown(axis, e)}
      >
        <sphereGeometry args={[handleScale * 3, 8, 8]} />
        <meshBasicMaterial visible={false} transparent opacity={0} />
      </mesh>
    </group>
  )
}

// ─── MeasurementScene ──────────────────────────────────────────────────────────
// Handles in-scene measurement with click-to-point interaction.
// Shows points as spheres, lines between them, and distance labels using Html.
// Escape clears all measurements, right-click cancels pending.

function MeasurementScene({ pluginManager }: { pluginManager: PluginManager }) {
  const modelObject = useViewerStore((s) => s.modelObject)
  const { camera, gl } = useThree()

  const plugin = pluginManager.getPlugin('measurement') as unknown as MeasurementPlugin | undefined

  const [measurements, setMeasurements] = useState<MeasurementData[]>([])
  const [pendingStart, setPendingStart] = useState<THREE.Vector3 | null>(null)

  // Subscribe to plugin state
  useEffect(() => {
    if (!plugin) return
    plugin.onStateChange((newMeasurements, newPending) => {
      setMeasurements([...newMeasurements])
      setPendingStart(newPending ? newPending.clone() : null)
    })
  }, [plugin])

  // Handle click to add measurement points
  useEffect(() => {
    if (!plugin || !modelObject) return

    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onClick = (event: MouseEvent) => {
      // Ignore right-clicks (handled separately)
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

  // Escape key to clear all measurements
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

  // Set crosshair cursor
  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.cursor = 'crosshair'
    return () => {
      canvas.style.cursor = 'default'
    }
  }, [gl])

  if (!modelObject || !plugin) return null

  // Compute scale factor for markers based on model size
  const modelBox = new THREE.Box3().setFromObject(modelObject)
  const modelExtent = modelBox.getSize(new THREE.Vector3()).length()

  return (
    <group>
      {/* Pending start point */}
      {pendingStart && (
        <MeasurementPoint position={pendingStart} scale={modelExtent} isPending />
      )}

      {/* Completed measurements */}
      {measurements.map((m) => (
        <MeasurementVisualization key={m.id} measurement={m} modelExtent={modelExtent} plugin={plugin} />
      ))}
    </group>
  )
}

function MeasurementPoint({ position, scale, isPending }: {
  position: THREE.Vector3
  scale: number
  isPending?: boolean
}) {
  const radius = Math.max(scale * 0.005, 0.005)
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial
        color={isPending ? '#ffaa44' : '#4a9eff'}
        depthTest={false}
      />
    </mesh>
  )
}

function MeasurementVisualization({ measurement, modelExtent, plugin }: {
  measurement: MeasurementData
  modelExtent: number
  plugin: MeasurementPlugin
}) {
  const { start, end, distance } = measurement
  const midPoint = useMemo(
    () => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5),
    [start, end]
  )

  const radius = Math.max(modelExtent * 0.004, 0.003)
  const formatted = plugin.formatDistance(distance)

  return (
    <group>
      {/* Start point */}
      <mesh position={start}>
        <sphereGeometry args={[radius, 12, 12]} />
        <meshBasicMaterial color="#4a9eff" depthTest={false} />
      </mesh>

      {/* End point */}
      <mesh position={end}>
        <sphereGeometry args={[radius, 12, 12]} />
        <meshBasicMaterial color="#4a9eff" depthTest={false} />
      </mesh>

      {/* Line */}
      <Line
        points={[start.toArray(), end.toArray()]}
        color="#4a9eff"
        lineWidth={2}
      />

      {/* Distance label — fixed pixel size, always readable */}
      <Html
        position={midPoint}
        center
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          background: 'rgba(0, 0, 0, 0.8)',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: 3,
          fontSize: 11,
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          border: '1px solid rgba(74, 158, 255, 0.5)',
        }}>
          {formatted}
        </div>
      </Html>
    </group>
  )
}

// ─── RotationControls ─────────────────────────────────────────────────────────
// Uses drei TransformControls in rotate mode around the model.
// Disables OrbitControls while dragging.

function RotationControls({ target, orbitRef }: { target: THREE.Object3D; orbitRef: React.RefObject<any> }) {
  const transformRef = useRef<any>(null)

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return

    const onDraggingChanged = (event: { value: boolean }) => {
      if (orbitRef.current) orbitRef.current.enabled = !event.value
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
    }
  }, [orbitRef])

  return (
    <TransformControls
      ref={transformRef}
      object={target}
      mode="rotate"
      size={0.7}
    />
  )
}
