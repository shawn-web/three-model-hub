/* eslint-disable react-refresh/only-export-components */
import type { FC } from 'react'
import { useSceneStore } from '../../store/scene-store'
import type { ViewerPlugin, ViewerContext } from '../types'

function GridScene() {
  const gridVisible = useSceneStore((s) => s.gridVisible)
  if (!gridVisible) return null
  return <gridHelper args={[100, 100]} />
}

function GridToolbarButton({ plugin }: { plugin: ViewerPlugin }) {
  const gridVisible = useSceneStore((s) => s.gridVisible)
  const setGridVisible = useSceneStore((s) => s.setGridVisible)
  return (
    <button
      className={`toolbar-btn ${gridVisible ? 'active' : ''}`}
      title="网格"
      onClick={() => setGridVisible(!gridVisible)}
    >
      {plugin.icon}
    </button>
  )
}

export class GridPlugin implements ViewerPlugin {
  id = 'grid'
  name = '网格'
  icon = 'grid'
  group = 'display' as const

  private active = false

  sceneComponent: FC = GridScene
  toolbarComponent: FC<{ plugin: ViewerPlugin }> = GridToolbarButton

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void {
    this.active = true
  }

  uninstall(): void {}

  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createGridPlugin(): ViewerPlugin {
  return new GridPlugin()
}
