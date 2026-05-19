import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import { fitToView } from '../utils/fit-to-view'
import { PluginScene } from '../components/PluginScene'
import { SceneBackground } from '../components/SceneBackground'
import type { PluginManager } from '../core/plugin-manager'

interface SceneSetupProps {
  pluginManager: PluginManager | null
}

export function SceneSetup({ pluginManager }: SceneSetupProps) {
  const controlsRef = useRef<any>(null)
  const modelGroupRef = useRef<THREE.Group>(null!)
  const { camera, scene, gl } = useThree()
  const modelObject = useViewerStore((s) => s.modelObject)
  const sceneConfig = useViewerStore((s) => s.sceneConfig)
  // 环境预设（保留供后续使用）

  useEffect(() => {
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

  /** 注册相机状态读写回调，供视点功能使用 */
  useEffect(() => {
    useViewerStore.getState().setGetCameraState(() => {
      const cam = camera as THREE.PerspectiveCamera
      const controls = controlsRef.current
      return {
        position: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
        target: controls
          ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
          : { x: 0, y: 0, z: 0 },
        up: { x: cam.up.x, y: cam.up.y, z: cam.up.z },
        fov: cam.fov,
      }
    })

    useViewerStore.getState().setSetCameraState((state) => {
      const cam = camera as THREE.PerspectiveCamera
      const controls = controlsRef.current
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
      useViewerStore.getState().setGetCameraState(null)
      useViewerStore.getState().setSetCameraState(null)
    }
  }, [camera])

  useEffect(() => {
    if (controlsRef.current && pluginManager) {
      const navPlugin = pluginManager.getPlugin('navigation') as any
      if (navPlugin?.setControlsRef) {
        navPlugin.setControlsRef(controlsRef.current)
      }
    }
  }, [pluginManager])

  useEffect(() => {
    if (modelObject && controlsRef.current) {
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, controlsRef.current, modelObject)
    }
  }, [modelObject, camera])

  // Set OrbitControls target to model center
  useEffect(() => {
    if (modelObject && controlsRef.current) {
      const box = new THREE.Box3().setFromObject(modelObject)
      const center = box.getCenter(new THREE.Vector3())
      controlsRef.current.target.copy(center)
      controlsRef.current.update()
    }
  }, [modelObject])

  return (
    <>
      <SceneBackground config={sceneConfig?.background ?? null} />
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
        ref={controlsRef}
        enableDamping
        dampingFactor={0.15}
        makeDefault
      />
      {/* 环境光和补光灯替代 HDR 环境贴图 */}
      <hemisphereLight intensity={0.3} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />
      {modelObject && (
        <group ref={modelGroupRef}>
          <primitive object={modelObject} />
        </group>
      )}
      {pluginManager && (
        <PluginScene
          pluginManager={pluginManager}
          modelGroupRef={modelGroupRef}
          orbitRef={controlsRef}
        />
      )}
    </>
  )
}
