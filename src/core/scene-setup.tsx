import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useViewerStore } from '../store/viewer-store'
import { fitToView } from '../utils/fit-to-view'

export function SceneSetup() {
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
    if (modelObject && controlsRef.current) {
      scene.add(modelObject)
      const cam = camera as THREE.PerspectiveCamera
      fitToView(cam, controlsRef.current, modelObject)
    }
    return () => {
      if (modelObject) {
        scene.remove(modelObject)
      }
    }
  }, [modelObject, scene, camera])

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
        dampingFactor={0.1}
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
    </>
  )
}
