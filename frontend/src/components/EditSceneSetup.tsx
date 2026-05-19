/**
 * 编辑器场景设置组件
 *
 * 在 React Three Fiber Canvas 内部运行，负责：
 * - 配置场景灯光（环境光、方向光、半球光）
 * - 配置 OrbitControls（轨道控制器）和 TransformControls（变换控制器）
 * - 处理模型点击选中（射线检测）
 * - 处理标点添加模式
 * - 注册相机状态读写回调
 * - 选中构件时自动聚焦相机
 * - 显示选中构件的高亮框
 * - 渲染标点精灵
 * - 处理键盘快捷键（W/E/R 切换变换模式）
 */

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, TransformControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import { fitToView } from '../utils/fit-to-view'
import { SceneBackground } from './SceneBackground'

/** 标点计数器，用于自动命名 */
let markerCounter = 0

/** 编辑器场景设置主组件 */
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

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

  /** 注册相机状态读写回调，供相机信息显示等使用 */
  useEffect(() => {
    useEditStore.getState().setGetCameraState(() => {
      const cam = camera as THREE.PerspectiveCamera
      const controls = orbitRef.current
      return {
        position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        target: controls
          ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
          : { x: 0, y: 0, z: 0 },
        up: { x: cam.up.x, y: cam.up.y, z: cam.up.z },
        fov: cam.fov,
      }
    })

    useEditStore.getState().setSetCameraState((state) => {
      const cam = camera as THREE.PerspectiveCamera
      const controls = orbitRef.current
      cam.position.set(state.position.x, state.position.y, state.position.z)
      if (controls) {
        controls.target.set(state.target.x, state.target.y, state.target.z)
      }
      if (state.up) {
        cam.up.set(state.up.x, state.up.y, state.up.z)
      }
      if (state.fov !== undefined) {
        cam.fov = state.fov
        cam.updateProjectionMatrix()
      }
      controls?.update()
    })

    return () => {
      useEditStore.getState().setGetCameraState(null)
      useEditStore.getState().setSetCameraState(null)
    }
  }, [camera])

  useEffect(() => {
    if (modelObject && orbitRef.current) {
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, orbitRef.current, modelObject)
    }
  }, [modelObject, camera])

  useEffect(() => {
    useEditStore.getState().setFitToViewFn(() => {
      if (!modelObject || !orbitRef.current || !camera) return
      fitToView(camera as THREE.PerspectiveCamera, orbitRef.current, modelObject)
    })
    return () => useEditStore.getState().setFitToViewFn(null)
  }, [modelObject, camera])

  useEffect(() => {
    if (!modelObject || !selectedComponentId) {
      setSelectedObj(null)
      return
    }
    const obj = modelObject.getObjectByProperty('uuid', selectedComponentId)
    setSelectedObj(obj || null)
  }, [modelObject, selectedComponentId])

  useEffect(() => {
    if (selectedObj && orbitRef.current) {
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, orbitRef.current, selectedObj)
    }
  }, [selectedObj, camera])

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

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!modelObject) return
    event.stopPropagation()

    if (addingMarker) {
      const raycaster = new THREE.Raycaster()
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
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

  useEffect(() => {
    gl.domElement.style.cursor = addingMarker ? 'crosshair' : 'default'
    return () => { gl.domElement.style.cursor = 'default' }
  }, [addingMarker, gl])

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

      {markers.map((marker) => (
        <MarkerSprite key={marker.id} marker={marker} onClick={(id) => {
          const m = useEditStore.getState().markers.find(mk => mk.id === id)
          if (m?.popup) {
            useEditStore.getState().setSelectedComponentId(null)
          }
        }} />
      ))}
    </>
  )
}

/** 选中构件高亮框组件：使用 BoxHelper 显示选中构件的包围盒 */
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

function MarkerSprite({ marker, onClick }: { marker: { id: string; position: [number, number, number]; imageUrl: string; width: number; height: number; name: string; popup?: any }; onClick?: (id: string) => void }) {
  const spriteRef = useRef<THREE.Sprite>(null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const [hasTexture, setHasTexture] = useState(false)
  const [hovered, setHovered] = useState(false)

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

  const scale = useMemo(() => {
    const w = marker.width || 1
    const h = marker.height || 1
    return [w, h, 1] as [number, number, number]
  }, [marker.width, marker.height])

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick?.(marker.id)
  }, [marker.id, onClick])

  const color = hovered ? '#ffaa44' : '#ff6600'

  if (hasTexture && textureRef.current) {
    return (
      <sprite
        ref={spriteRef}
        position={marker.position}
        scale={scale}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <spriteMaterial map={textureRef.current} depthTest={false} />
      </sprite>
    )
  }

  return (
    <mesh
      position={marker.position}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.08, 12, 12]} />
      <meshBasicMaterial color={color} depthTest={false} />
    </mesh>
  )
}
