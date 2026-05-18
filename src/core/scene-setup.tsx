import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import { fitToView } from '../utils/fit-to-view'
import { PluginScene } from '../components/PluginScene'
import type { PluginManager } from '../core/plugin-manager'

interface SceneSetupProps {
  pluginManager: PluginManager | null
}

export function SceneSetup({ pluginManager }: SceneSetupProps) {
  const controlsRef = useRef<any>(null)
  const { camera, scene, gl } = useThree()
  const modelObject = useViewerStore((s) => s.modelObject)
  const environmentPreset = useViewerStore((s) => s.environmentPreset)

  useEffect(() => {
    scene.background = new THREE.Color(0x1a1a2e)
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.0
  }, [scene, gl])

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
      {environmentPreset !== 'none' && (
        <Environment preset={environmentPreset as any} background={false} />
      )}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.15} />
      </mesh>
      <gridHelper args={[100, 100, 0x444444, 0x222222]} />
      {modelObject && <primitive object={modelObject} />}
      {pluginManager && <PluginScene pluginManager={pluginManager} />}
    </>
  )
}
