/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, type FC } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { useSceneStore } from '../../store/scene-store'
import { useEditStore } from '../../store/edit-store'
import { SelectionHighlightManager } from '../../utils/selection-highlight'
import type { ViewerPlugin, ViewerContext } from '../types'

/** 选中高亮的 BoxHelper 组件 */
function SelectionBoxHelper() {
  const modelObject = useSceneStore((s) => s.modelObject)
  const selectedComponentId = useSceneStore((s) => s.selectedComponentId)
  const { scene } = useThree()

  const selectedObj = useMemo(() => {
    if (!modelObject || !selectedComponentId) return null
    return modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | null
  }, [modelObject, selectedComponentId])

  useEffect(() => {
    const mesh = selectedObj as THREE.Mesh | null
    if (!mesh || !mesh.isMesh) return
    const boxHelper = new THREE.BoxHelper(mesh, 0x4a9eff)
    boxHelper.renderOrder = 999
    scene.add(boxHelper)
    return () => { scene.remove(boxHelper); boxHelper.dispose() }
  }, [selectedObj, scene])

  return null
}

function XRayScene() {
  const modelObject = useSceneStore((s) => s.modelObject)
  const selectedComponentId = useSceneStore((s) => s.selectedComponentId)
  const xrayMode = useSceneStore((s) => s.xrayMode)
  const setHighlightManagerScene = useSceneStore((s) => s.setHighlightManager)
  const setHighlightManagerEdit = useEditStore((s) => s.setHighlightManager)

  const manager = useMemo(() => new SelectionHighlightManager(), [])

  useEffect(() => {
    setHighlightManagerScene(manager)
    setHighlightManagerEdit(manager)
    return () => { setHighlightManagerScene(null); setHighlightManagerEdit(null); manager.clearAll() }
  }, [manager, setHighlightManagerScene, setHighlightManagerEdit])

  useEffect(() => {
    if (!modelObject) return
    manager.applyHighlight(modelObject, selectedComponentId)
    manager.applyXRay(modelObject, selectedComponentId, xrayMode)
    return () => { manager.clearAll() }
  }, [modelObject, selectedComponentId, xrayMode, manager])

  return <SelectionBoxHelper />
}

function XRayToolbarButton({ plugin }: { plugin: ViewerPlugin }) {
  const xrayMode = useSceneStore((s) => s.xrayMode)
  const setXrayMode = useSceneStore((s) => s.setXrayMode)
  return (
    <button
      className={`toolbar-btn ${xrayMode ? 'active' : ''}`}
      title="透视模式"
      onClick={() => setXrayMode(!xrayMode)}
    >
      {plugin.icon}
    </button>
  )
}

export class XRayPlugin implements ViewerPlugin {
  id = 'xray'
  name = '透视'
  icon = 'eye'
  group = 'display' as const

  private active = false

  sceneComponent: FC = XRayScene
  toolbarComponent: FC<{ plugin: ViewerPlugin }> = XRayToolbarButton

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void { this.active = true }
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createXRayPlugin(): ViewerPlugin {
  return new XRayPlugin()
}
