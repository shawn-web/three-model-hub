/* eslint-disable react-refresh/only-export-components */
import { useSceneStore } from '../../store/scene-store'
import { ViewCube } from '../../components/ViewCube'
import type { ViewerPlugin, ViewerContext } from '../types'

/** ViewCube DOM 覆盖层组件（渲染在 Canvas 外部） */
export function ViewCubeOverlay() {
  const getCameraState = useSceneStore((s) => s.getCameraState)
  const setCameraState = useSceneStore((s) => s.setCameraState)
  const modelObject = useSceneStore((s) => s.modelObject)

  if (!modelObject) return null

  return (
    <ViewCube
      getCameraState={getCameraState}
      setCameraState={setCameraState}
      modelObject={modelObject}
    />
  )
}

export class ViewCubePlugin implements ViewerPlugin {
  id = 'viewCube'
  name = '导航立方体'
  icon = 'cube'
  group = 'display' as const

  private active = false

  /** ViewCube 通过 DOM 覆盖层渲染，不使用 sceneComponent */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void { this.active = true }
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createViewCubePlugin(): ViewerPlugin {
  return new ViewCubePlugin()
}
