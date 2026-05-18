import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { EditSceneSetup } from './EditSceneSetup'

export function EditCanvas() {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.001, far: 100000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <EditSceneSetup />
      </Suspense>
    </Canvas>
  )
}
