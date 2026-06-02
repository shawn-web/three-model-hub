import { useEditStore } from '../store/edit-store'
import * as THREE from 'three'
import { InputNumber } from 'antd'
import type { TransformMode } from '../store/edit-store'

/** 将弧度转换为角度 */
const radToDeg = (rad: number) => (rad * 180) / Math.PI

/** 将角度转换为弧度 */
const degToRad = (deg: number) => (deg * Math.PI) / 180

/** 轴配置：标签 + 颜色 */
const AXIS_CONFIG = [
  { label: 'X', color: '#ff6b6b' },
  { label: 'Y', color: '#51cf66' },
  { label: 'Z', color: '#4a9eff' },
] as const

/** 模式配置 */
const MODE_CONFIG: Record<Exclude<TransformMode, null>, { label: string; step: number }> = {
  translate: { label: '位置', step: 0.1 },
  rotate: { label: '旋转 (度)', step: 1 },
  scale: { label: '缩放', step: 0.1 },
}

/**
 * 变换数值输入面板
 * 在编辑器工具栏上方显示当前选中对象的位置/旋转/缩放值，支持直接输入
 */
export function TransformInputPanel() {
  const transformMode = useEditStore((s) => s.transformMode)
  const selectedComponentId = useEditStore((s) => s.selectedComponentId)
  const modelObject = useEditStore((s) => s.modelObject)
  const editData = useEditStore((s) =>
    s.selectedComponentId ? s.editData[s.selectedComponentId] : null,
  )
  const updateComponentTransform = useEditStore((s) => s.updateComponentTransform)

  // 条件不满足时不渲染
  if (!transformMode || !selectedComponentId || !modelObject) return null

  const obj = modelObject.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | undefined
  if (!obj) return null

  const data = editData
  const config = MODE_CONFIG[transformMode]

  // 获取当前值（优先从 editData，否则从 Three.js 对象）
  const getValues = (): [number, number, number] => {
    switch (transformMode) {
      case 'translate':
        return data?.position ?? (obj.position.toArray() as [number, number, number])
      case 'rotate':
        return data?.rotation ?? [obj.rotation.x, obj.rotation.y, obj.rotation.z]
      case 'scale':
        return data?.scale ?? (obj.scale.toArray() as [number, number, number])
    }
  }

  // 显示值（旋转需要转角度）
  const getDisplayValue = (axis: number): number => {
    const values = getValues()
    const raw = values[axis]
    return transformMode === 'rotate' ? parseFloat(radToDeg(raw).toFixed(1)) : parseFloat(raw.toFixed(2))
  }

  // 处理值变更
  const handleChange = (axis: number, value: number | null) => {
    const currentObj = useEditStore.getState().modelObject?.getObjectByProperty('uuid', selectedComponentId) as THREE.Object3D | null
    if (!currentObj) return

    const v = value ?? (transformMode === 'scale' ? 1 : 0)

    switch (transformMode) {
      case 'translate': {
        const newPos = [...getValues()] as [number, number, number]
        newPos[axis] = v
        currentObj.position.set(...newPos)
        updateComponentTransform(selectedComponentId, { position: newPos })
        break
      }
      case 'rotate': {
        const newRot = [...getValues()] as [number, number, number]
        newRot[axis] = degToRad(v)
        currentObj.rotation.set(...newRot)
        updateComponentTransform(selectedComponentId, { rotation: newRot })
        break
      }
      case 'scale': {
        const newScale = [...getValues()] as [number, number, number]
        newScale[axis] = v
        currentObj.scale.set(...newScale)
        updateComponentTransform(selectedComponentId, { scale: newScale })
        break
      }
    }
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 min-w-[260px] bg-[rgba(20,20,30,0.9)] rounded-[10px] backdrop-blur-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.4)] py-2 px-3 animate-[transformPanelIn_0.15s_ease-out]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 模式标题 */}
      <div className="text-[11px] text-[#aaa] mb-1.5 font-medium">{config.label}</div>

      {/* 轴输入行 */}
      <div className="flex gap-2">
        {AXIS_CONFIG.map((axis, i) => (
          <div key={axis.label} className="flex-1">
            <div className="text-[10px] mb-0.5 font-medium" style={{ color: axis.color }}>
              {axis.label}
            </div>
            <InputNumber
              size="small"
              step={config.step}
              value={getDisplayValue(i)}
              onChange={(v) => handleChange(i, v)}
              className="w-full [&_.ant-input-number-input]:text-[12px] [&_.ant-input-number]:bg-[rgba(255,255,255,0.08)] [&_.ant-input-number]:border-[rgba(255,255,255,0.12)] [&_.ant-input-number:hover]:border-[rgba(255,255,255,0.25)]"
              controls={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
