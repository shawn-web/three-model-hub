import { useRef, useEffect, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, Environment } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditStore } from '../store/edit-store'
import { fitToView } from '../utils/fit-to-view'

export function EditSceneSetup() {
  const orbitRef = useRef<any>(null)
  const transformRef = useRef<any>(null)
  const { camera, scene, gl } = useThree()
  const modelObject = useEditStore((s) => s.modelObject)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const transformMode = useEditStore((s) => s.transformMode)

  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null)

  // Setup scene
  useEffect(() => {
    scene.background = new THREE.Color(0x1a1a2e)
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

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

  // Click handler for component selection
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (!modelObject) return
    event.stopPropagation()

    // Walk up from clicked mesh to find a direct child of the model root
    let target: THREE.Object3D = event.object
    while (target.parent && target.parent !== modelObject && target.parent !== scene) {
      target = target.parent
    }

    // Don't select the model root itself
    if (target === modelObject) {
      useEditStore.getState().selectComponent(null)
      return
    }

    useEditStore.getState().selectComponent(target.uuid)
  }, [modelObject, scene])

  return (
    <>
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
      <OrbitControls ref={orbitRef} enableDamping dampingFactor={0.15} makeDefault />
      <Environment preset="city" background={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />

      {/* Model */}
      {modelObject && (
        <primitive object={modelObject} onClick={handleClick} />
      )}

      {/* Selection highlight */}
      {selectedObj && (
        <SelectionHighlight object={selectedObj} />
      )}

      {/* TransformControls */}
      {selectedObj && (
        <TransformControls
          ref={transformRef}
          object={selectedObj}
          mode={transformMode}
          size={0.7}
        />
      )}
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
