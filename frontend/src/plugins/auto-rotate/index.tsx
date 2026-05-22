/* eslint-disable react-refresh/only-export-components */
import type { FC } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSceneStore } from '../../store/scene-store'
import type { ViewerPlugin, ViewerContext } from '../types'

function AutoRotateScene() {
  const modelObject = useSceneStore((s) => s.modelObject)
  const autoRotate = useSceneStore((s) => s.autoRotate)
  const autoRotateAxis = useSceneStore((s) => s.autoRotateAxis)
  const autoRotateSpeed = useSceneStore((s) => s.autoRotateSpeed)

  useFrame((_state, delta) => {
    if (!autoRotate || !modelObject || autoRotateAxis === 'y') return
    const speed = autoRotateSpeed * delta
    const axis = autoRotateAxis === 'x' ? 'x' : 'z'
    // eslint-disable-next-line react-hooks/immutability -- useFrame 回调中修改 Three.js 对象 rotation 是标准用法
    modelObject.rotation[axis] += speed
  })

  return null
}

function AutoRotateToolbar({ plugin }: { plugin: ViewerPlugin }) {
  const autoRotate = useSceneStore((s) => s.autoRotate)
  const autoRotateSpeed = useSceneStore((s) => s.autoRotateSpeed)
  const setAutoRotate = useSceneStore((s) => s.setAutoRotate)
  const setAutoRotateSpeed = useSceneStore((s) => s.setAutoRotateSpeed)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        className={`toolbar-btn ${autoRotate ? 'active' : ''}`}
        title="自动旋转"
        onClick={() => setAutoRotate(!autoRotate)}
      >
        {plugin.icon}
      </button>
      {autoRotate && (
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={autoRotateSpeed}
          onChange={(e) => setAutoRotateSpeed(Number(e.target.value))}
          style={{ width: 60 }}
          title={`速度: ${autoRotateSpeed}`}
        />
      )}
    </div>
  )
}

export class AutoRotatePlugin implements ViewerPlugin {
  id = 'autoRotate'
  name = '自动旋转'
  icon = 'sync'
  group = 'display' as const

  private context: ViewerContext | null = null
  private active = false

  sceneComponent: FC = AutoRotateScene
  toolbarComponent: FC<{ plugin: ViewerPlugin }> = AutoRotateToolbar

  install(context: ViewerContext): void {
    this.context = context
    this.active = true
  }
  uninstall(): void { this.context = null }
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createAutoRotatePlugin(): ViewerPlugin {
  return new AutoRotatePlugin()
}
