import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { SceneSetup } from '../core/scene-setup'

export function ViewerCanvas() {
  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 50, near: 0.01, far: 10000 }}
      shadows
      dpr={window.devicePixelRatio}
      gl={{ antialias: true, alpha: false }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={null}>
        <SceneSetup />
      </Suspense>
    </Canvas>
  )
}
