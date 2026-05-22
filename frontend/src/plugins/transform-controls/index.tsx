/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useMemo, type FC } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useSceneStore } from '../../store/scene-store'
import { useEditStore, type TransformMode } from '../../store/edit-store'
import type { ViewerPlugin, ViewerContext } from '../types'

function TransformControlsScene() {
  const modelObject = useSceneStore((s) => s.modelObject)
  const selectedComponentId = useSceneStore((s) => s.selectedComponentId)
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)

  const transformRef = useRef<TransformControls>(null)
  const orbitRef = useRef<OrbitControlsImpl | null>(null)
  useThree()

  const selectedObj = useMemo(() => {
    if (!modelObject || !selectedComponentId) return null
    return modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | null
  }, [modelObject, selectedComponentId])

  // 键盘快捷键 W/E/R
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key.toLowerCase()) {
        case 'w': setTransformMode(transformMode === 'translate' ? null : 'translate'); break
        case 'e': setTransformMode(transformMode === 'rotate' ? null : 'rotate'); break
        case 'r': setTransformMode(transformMode === 'scale' ? null : 'scale'); break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [transformMode, setTransformMode])

  // 拖拽处理
  useEffect(() => {
    const controls = transformRef.current
    if (!controls) return

    const onDraggingChanged = (e: { value: boolean }) => {
      if (orbitRef.current) orbitRef.current.enabled = !e.value
    }

    const onObjectChange = () => {
      const obj = controls.object as THREE.Object3D
      if (!obj) return
      useEditStore.getState().updateComponentTransform(obj.uuid, {
        position: obj.position.toArray() as [number, number, number],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: obj.scale.toArray() as [number, number, number],
      })
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('objectChange', onObjectChange)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      controls.removeEventListener('objectChange', onObjectChange)
    }
  }, [selectedObj])

  // 将 orbitRef 注册到 context（在 effect 中处理避免渲染期访问 ref）
  useEffect(() => {
    const refObj = transformRef.current as (TransformControls & { __orbitRef?: OrbitControlsImpl }) | null
    if (refObj && refObj.__orbitRef) {
      orbitRef.current = refObj.__orbitRef
    }
  })

  if (!selectedObj || !transformMode) return null

  return (
    <TransformControls
      ref={transformRef}
      object={selectedObj}
      mode={transformMode}
      size={0.7}
    />
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TransformControlsToolbar({ plugin: _plugin }: { plugin: ViewerPlugin }) {
  const transformMode = useEditStore((s) => s.transformMode)
  const setTransformMode = useEditStore((s) => s.setTransformMode)

  const modes: { key: string; mode: TransformMode }[] = [
    { key: 'W', mode: 'translate' },
    { key: 'E', mode: 'rotate' },
    { key: 'R', mode: 'scale' },
  ]

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {modes.map(({ key, mode }) => (
        <button
          key={key}
          className={`toolbar-btn ${transformMode === mode ? 'active' : ''}`}
          title={`${mode === 'translate' ? '平移' : mode === 'rotate' ? '旋转' : '缩放'} (${key})`}
          onClick={() => setTransformMode(transformMode === mode ? null : mode)}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

export class TransformControlsPlugin implements ViewerPlugin {
  id = 'transformControls'
  name = '变换控件'
  icon = 'transform'
  group = 'interaction' as const

  private active = false

  sceneComponent: FC = TransformControlsScene
  toolbarComponent: FC<{ plugin: ViewerPlugin }> = TransformControlsToolbar

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  install(_context: ViewerContext): void { this.active = true }
  uninstall(): void {}
  activate(): void { this.active = true }
  deactivate(): void { this.active = false }
  isActive(): boolean { return this.active }
}

export function createTransformControlsPlugin(): ViewerPlugin {
  return new TransformControlsPlugin()
}
