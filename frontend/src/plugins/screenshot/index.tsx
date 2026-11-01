/* eslint-disable react-refresh/only-export-components */
import type { FC } from 'react'
import type { ViewerPlugin, ViewerContext } from '../types'
import { captureScreenshot } from '../../utils/screenshot'

function ScreenshotToolbarButton({ plugin }: { plugin: ViewerPlugin }) {
  const handleClick = () => {
    captureScreenshot()
  }
  return (
    <button className="toolbar-btn" title="截图" onClick={handleClick}>
      {plugin.icon}
    </button>
  )
}

export class ScreenshotPlugin implements ViewerPlugin {
  id = 'screenshot'
  name = '截图'
  icon = 'camera'
  group = 'tool' as const

  private active = false

  toolbarComponent: FC<{ plugin: ViewerPlugin }> = ScreenshotToolbarButton

   
  install(_context: ViewerContext): void { this.active = true }
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createScreenshotPlugin(): ViewerPlugin {
  return new ScreenshotPlugin()
}
