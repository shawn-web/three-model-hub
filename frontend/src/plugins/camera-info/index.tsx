/* eslint-disable react-refresh/only-export-components */
import { type FC } from 'react'
import { useSceneStore } from '../../store/scene-store'
import type { ViewerPlugin, ViewerContext } from '../types'

function CameraInfoToolbarButton({ plugin }: { plugin: ViewerPlugin }) {
  const cameraInfoVisible = useSceneStore((s) => s.cameraInfoVisible)
  const setCameraInfoVisible = useSceneStore((s) => s.setCameraInfoVisible)
  return (
    <button
      className={`toolbar-btn ${cameraInfoVisible ? 'active' : ''}`}
      title="相机信息"
      onClick={() => setCameraInfoVisible(!cameraInfoVisible)}
    >
      {plugin.icon}
    </button>
  )
}

export class CameraInfoPlugin implements ViewerPlugin {
  id = 'cameraInfo'
  name = '相机信息'
  icon = 'info'
  group = 'display' as const

  private active = false

  toolbarComponent: FC<{ plugin: ViewerPlugin }> = CameraInfoToolbarButton

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void {
    this.active = true
  }
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createCameraInfoPlugin(): ViewerPlugin {
  return new CameraInfoPlugin()
}
