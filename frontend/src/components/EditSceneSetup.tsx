import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import { fitToView } from '../utils/fit-to-view'
import { SceneBackground } from './SceneBackground'

// 标点计数器：删除后依然递增，避免编号重复
let markerCounter = 0

export function EditSceneSetup() {
  const orbitRef = useRef<any>(null)
  const transformRef = useRef<any>(null)
  const { camera, scene, gl } = useThree()
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const transformMode = useEditStore((s) => s.transformMode)
  const autoRotate = useEditStore((s) => s.autoRotate)
  const backgroundColor = useEditStore((s) => s.backgroundColor)
  const backgroundConfig = useEditStore((s) => s.backgroundConfig)
  const markers = useEditStore((s) => s.markers)
  const addingMarker = useEditStore((s) => s.addingMarker)

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)

  // Setup scene
  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

  // Update background color reactively
  useEffect(() => {
    scene.background = new THREE.Color(backgroundColor)
  }, [backgroundColor, scene])

  // Fit view when model loads
  useEffect(() => {
    if (modelObject && orbitRef.current) {
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, orbitRef.current, modelObject)
    }
  }, [modelObject, camera])

  // Sync selectedComponentId to actual Three.js object
  useEffect(() => {
    if (!modelObject || !selectedComponentId) {
      setSelectedObj(null)
      return
    }
    const obj = modelObject.getObjectByProperty('uuid', selectedComponentId)
    setSelectedObj(obj || null)
  }, [modelObject, selectedComponentId])

  // TransformControls events
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return

    const onDraggingChanged = (e: { value: boolean }) => {
      if (orbitRef.current) orbitRef.current.enabled = !e.value
    }

    const onObjectChange = () => {
      const obj = controls.object as THREE.Object3D
      if (!obj) return
      useEditStore.getState().updateComponentTransform(obj.uuid, {
        position: obj.position.toArray() as [number, number, number],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: obj.scale.toArray() as [number, number, number],
      })
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('objectChange', onObjectChange)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      controls.removeEventListener('objectChange', onObjectChange)
    }
  }, [selectedObj])

  // Click handler for component selection or marker placement
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!modelObject) return
    event.stopPropagation()

    // Marker placement mode
    if (addingMarker) {
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2(
        ((event.nativeEvent.offsetX / gl.domElement.clientWidth) * 2 - 1),
        -((event.nativeEvent.offsetY / gl.domElement.clientHeight) * 2 + 1),
      )
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(modelObject.children, true)
      if (intersects.length > 0) {
        const point = intersects[0].point
        useEditStore.getState().addMarker({
          id: `marker-${Date.now()}`,
          position: point.toArray() as [number, number, number],
          imageUrl: '',
          width: 1,
          height: 1,
          name: `标点 ${++markerCounter}`,
        })
        useEditStore.getState().setAddingMarker(false)
      }
      return
    }

    // Normal selection
    let target: THREE.Object3D = event.object
    while (target.parent && target.parent !== modelObject && target.parent !== scene) {
      target = target.parent
    }

    if (target === modelObject) {
      useEditStore.getState().selectComponent(null)
      return
    }

    useEditStore.getState().selectComponent(target.uuid)
  }, [modelObject, scene, addingMarker, camera, gl])

  // Cursor for marker mode
  useEffect(() => {
    gl.domElement.style.cursor = addingMarker ? 'crosshair' : 'default'
    return () => { gl.domElement.style.cursor = 'default' }
  }, [addingMarker, gl])

  /** 快捷键处理：W=移动, E=旋转, R=缩放 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const store = useEditStore.getState()
      switch (e.key.toLowerCase()) {
        case 'w':
          store.setTransformMode('translate')
          break
        case 'e':
          store.setTransformMode('rotate')
          break
        case 'r':
          store.setTransformMode('scale')
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <SceneBackground config={backgroundConfig} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.15}
        makeDefault
        autoRotate={autoRotate}
        autoRotateSpeed={2}
      />
      {/* 环境光和补光灯替代 HDR 环境贴图 */}
      <hemisphereLight intensity={0.3} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />

      {modelObject && (
        <primitive object={modelObject} onClick={handleClick} />
      )}

      {selectedObj && (
        <SelectionHighlight object={selectedObj} />
      )}

      {selectedObj && (
        <TransformControls
          ref={transformRef}
          object={selectedObj}
          mode={transformMode}
          size={0.7}
        />
      )}

      {/* Render markers as sprites */}
      {markers.map((marker) => (
        <MarkerSprite key={marker.id} marker={marker} />
      ))}
    </>
  )
}

function SelectionHighlight({ object }: { object: THREE.Object3D }) {
  const [boxHelper, setBoxHelper] = useState<THREE.BoxHelper | null>(null)

  useEffect(() => {
    const helper = new THREE.BoxHelper(object, 0x4a9eff)
    setBoxHelper(helper)
    return () => { setBoxHelper(null) }
  }, [object])

  useEffect(() => {
    if (!boxHelper) return
    const interval = setInterval(() => boxHelper.update(), 100)
    return () => clearInterval(interval)
  }, [boxHelper])

  if (!boxHelper) return null
  return <primitive object={boxHelper} />
}

function MarkerSprite({ marker }: { marker: { id: string; position: [number, number, number]; imageUrl: string; width: number; height: number; name: string } }) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const [hasTexture, setHasTexture] = useState(false)

  useEffect(() => {
    if (!marker.imageUrl) return
    const loader = new THREE.TextureLoader()
    loader.load(
      marker.imageUrl,
      (tex) => {
        if (textureRef.current) textureRef.current.dispose()
        textureRef.current = tex
        setHasTexture(true)
      },
      undefined,
      () => { setHasTexture(false) },
    )
    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
        textureRef.current = null
      }
    }
  }, [marker.imageUrl])

  // Default pin appearance when no image
  const scale = useMemo(() => {
    const w = marker.width || 1
    const h = marker.height || 1
    return [w, h, 1] as [number, number, number]
  }, [marker.width, marker.height])

  if (hasTexture && textureRef.current) {
    return (
      <sprite ref={spriteRef} position={marker.position} scale={scale}>
        <spriteMaterial map={textureRef.current} depthTest={false} />
      </sprite>
    )
  }

  // Default colored sphere when no image
  return (
    <mesh position={marker.position}>
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color="#ff6600" depthTest={false} />
    </mesh>
  )
}
