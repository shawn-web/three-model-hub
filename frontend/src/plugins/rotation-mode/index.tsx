/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, type FC } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import { useSceneStore } from '../../store/scene-store'
import type { ViewerPlugin, ViewerContext } from '../types'

function RotationModeScene() {
  const modelObject = useSceneStore((s) => s.modelObject)
  const transformRef = useRef<TransformControls>(null)
  const { gl } = useThree()

  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return
    const canvas = gl.domElement

    const onDraggingChanged = (event: { value: boolean }) => {
      canvas.style.pointerEvents = event.value ? 'none' : 'auto'
    }
    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => { controls.removeEventListener('dragging-changed', onDraggingChanged) }
  }, [gl])

  if (!modelObject?.parent) return null

  return (
    <TransformControls ref={transformRef} object={modelObject} mode="rotate" size={0.7} />
  )
}

function RotationModeToolbarButton({ plugin }: { plugin: ViewerPlugin }) {
  // rotationMode state managed by the plugin's activate/deactivate
  const isActive = plugin.isActive()
  return (
    <button className={`toolbar-btn ${isActive ? 'active' : ''}`} title="旋转模式">
      {plugin.icon}
    </button>
  )
}

export class RotationModePlugin implements ViewerPlugin {
  id = 'rotationMode'
  name = '旋转模式'
  icon = 'rotate'
  group = 'interaction' as const

  private active = false

  sceneComponent: FC = RotationModeScene
  toolbarComponent: FC<{ plugin: ViewerPlugin }> = RotationModeToolbarButton

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void {}
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createRotationModePlugin(): ViewerPlugin {
  return new RotationModePlugin()
}
